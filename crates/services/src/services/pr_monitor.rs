use std::{path::PathBuf, sync::Arc, time::Duration};

use db::{
    DBService,
    models::{
        execution_process::{ExecutionProcess, ExecutionProcessError, ExecutionProcessRunReason},
        merge::{CiStatus, Merge, MergeStatus, PrMerge},
        repo::Repo,
        session::{CreateSession, Session, SessionError},
        task::{Task, TaskStatus},
        workspace::{Workspace, WorkspaceError},
    },
};
use executors::actions::{
    ExecutorAction, ExecutorActionType,
    coding_agent_follow_up::CodingAgentFollowUpRequest,
    coding_agent_initial::CodingAgentInitialRequest,
};
use serde_json::json;
use sqlx::error::Error as SqlxError;
use thiserror::Error;
use tokio::{sync::RwLock, time::interval};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::services::{
    analytics::AnalyticsContext,
    config::Config,
    container::ContainerService,
    git::{GitService, GitServiceError},
    git_host::{self, GitHostError, GitHostProvider},
    share::SharePublisher,
};

#[derive(Debug, Error)]
enum PrMonitorError {
    #[error(transparent)]
    GitHostError(#[from] GitHostError),
    #[error(transparent)]
    WorkspaceError(#[from] WorkspaceError),
    #[error(transparent)]
    Sqlx(#[from] SqlxError),
    #[error(transparent)]
    GitService(#[from] GitServiceError),
    #[error(transparent)]
    Session(#[from] SessionError),
    #[error(transparent)]
    ExecutionProcess(#[from] ExecutionProcessError),
    #[error("Container error: {0}")]
    Container(String),
}

/// Status of merge conflict auto-resolution attempt
#[derive(Debug)]
enum MergeConflictResolution {
    /// No conflicts detected
    NoConflicts,
    /// Conflicts were detected and successfully resolved via rebase
    Resolved,
    /// Conflicts were detected but could not be auto-resolved
    Failed {
        conflicted_files: Vec<String>,
        message: String,
    },
}

/// Default prompt for AI-assisted conflict resolution (same as in pr.rs)
pub const DEFAULT_CONFLICT_RESOLUTION_PROMPT: &str = r#"The branch has merge conflicts with the target branch that could not be automatically resolved.

Your task is to resolve these conflicts by:
1. Running `git rebase {target_branch}` to start the rebase
2. For each conflicted file, open it, understand both versions, and resolve the conflict by choosing the appropriate code or merging both changes
3. After resolving each file, run `git add <file>` to mark it as resolved
4. Run `git rebase --continue` to proceed with the rebase
5. If you encounter additional conflicts, repeat steps 2-4
6. Once the rebase is complete, the conflicts will be resolved

Conflicted files: {conflicted_files}

Important guidelines:
- Preserve functionality from both branches when possible
- If unsure about which change to keep, prefer the changes from the current branch (the feature branch)
- Test that the code compiles after resolving conflicts
- Do NOT use `git rebase --abort` unless absolutely necessary"#;

/// Service to monitor PRs and update task status when they are merged
/// Also detects and addresses merge conflicts for tasks in review
pub struct PrMonitorService<C: ContainerService + Send + Sync + 'static> {
    db: DBService,
    poll_interval: Duration,
    analytics: Option<AnalyticsContext>,
    publisher: Option<SharePublisher>,
    git: GitService,
    container: C,
    config: Arc<RwLock<Config>>,
}

impl<C: ContainerService + Send + Sync + 'static> PrMonitorService<C> {
    pub async fn spawn(
        db: DBService,
        analytics: Option<AnalyticsContext>,
        publisher: Option<SharePublisher>,
        git: GitService,
        container: C,
        config: Arc<RwLock<Config>>,
    ) -> tokio::task::JoinHandle<()> {
        let service = Self {
            db,
            poll_interval: Duration::from_secs(60), // Check every minute
            analytics,
            publisher,
            git,
            container,
            config,
        };
        tokio::spawn(async move {
            service.start().await;
        })
    }

    async fn start(&self) {
        info!(
            "Starting PR monitoring service with interval {:?}",
            self.poll_interval
        );

        let mut interval = interval(self.poll_interval);

        loop {
            interval.tick().await;
            if let Err(e) = self.check_all_open_prs().await {
                error!("Error checking open PRs: {}", e);
            }
        }
    }

    /// Check all open PRs for updates with the provided GitHub token
    async fn check_all_open_prs(&self) -> Result<(), PrMonitorError> {
        let open_prs = Merge::get_open_prs(&self.db.pool).await?;

        if open_prs.is_empty() {
            debug!("No open PRs to check");
            return Ok(());
        }

        info!("Checking {} open PRs", open_prs.len());

        for pr_merge in open_prs {
            if let Err(e) = self.check_pr_status(&pr_merge).await {
                error!(
                    "Error checking PR #{} for workspace {}: {}",
                    pr_merge.pr_info.number, pr_merge.workspace_id, e
                );
            }
        }
        Ok(())
    }

    /// Check the status of a specific PR
    async fn check_pr_status(&self, pr_merge: &PrMerge) -> Result<(), PrMonitorError> {
        let git_host = git_host::GitHostService::from_url(&pr_merge.pr_info.url)?;
        let pr_status = git_host.get_pr_status(&pr_merge.pr_info.url).await?;

        // Fetch CI status for open PRs
        let ci_status = if matches!(&pr_status.status, MergeStatus::Open) {
            match git_host.get_ci_status(&pr_merge.pr_info.url).await {
                Ok(status) => status,
                Err(e) => {
                    debug!(
                        "Failed to fetch CI status for PR #{}: {}",
                        pr_merge.pr_info.number, e
                    );
                    CiStatus::Unknown
                }
            }
        } else {
            // For merged/closed PRs, preserve existing CI status or set to Unknown
            pr_merge.pr_info.ci_status.clone()
        };

        debug!(
            "PR #{} status: {:?}, CI: {:?} (was open)",
            pr_merge.pr_info.number, pr_status.status, ci_status
        );

        // Always update CI status for open PRs, or update everything if PR status changed
        let pr_status_changed = !matches!(&pr_status.status, MergeStatus::Open);
        let ci_status_changed = ci_status != pr_merge.pr_info.ci_status;

        if pr_status_changed {
            // Update merge status with the latest information from git host
            Merge::update_status(
                &self.db.pool,
                pr_merge.id,
                pr_status.status.clone(),
                pr_status.merge_commit_sha,
                ci_status,
            )
            .await?;

            // If the PR was merged, update the task status to done
            if matches!(&pr_status.status, MergeStatus::Merged)
                && let Some(workspace) =
                    Workspace::find_by_id(&self.db.pool, pr_merge.workspace_id).await?
            {
                info!(
                    "PR #{} was merged, updating task {} to done and archiving workspace",
                    pr_merge.pr_info.number, workspace.task_id
                );
                Task::update_status(&self.db.pool, workspace.task_id, TaskStatus::Done).await?;

                // Archive workspace unless pinned
                if !workspace.pinned {
                    Workspace::set_archived(&self.db.pool, workspace.id, true).await?;
                }

                // Track analytics event
                if let Some(analytics) = &self.analytics
                    && let Ok(Some(task)) = Task::find_by_id(&self.db.pool, workspace.task_id).await
                {
                    analytics.analytics_service.track_event(
                        &analytics.user_id,
                        "pr_merged",
                        Some(json!({
                            "task_id": workspace.task_id.to_string(),
                            "workspace_id": workspace.id.to_string(),
                            "project_id": task.project_id.to_string(),
                        })),
                    );
                }

                if let Some(publisher) = &self.publisher
                    && let Err(err) = publisher.update_shared_task_by_id(workspace.task_id).await
                {
                    tracing::warn!(
                        ?err,
                        "Failed to propagate shared task update for {}",
                        workspace.task_id
                    );
                }
            }
        } else if ci_status_changed {
            // Only CI status changed, update just that
            Merge::update_ci_status(&self.db.pool, pr_merge.id, ci_status).await?;
        }

        // For open PRs, check for merge conflicts and attempt auto-resolution
        if matches!(&pr_status.status, MergeStatus::Open) {
            if let Err(e) = self.check_and_resolve_conflicts(pr_merge).await {
                warn!(
                    "Error checking/resolving conflicts for PR #{}: {}",
                    pr_merge.pr_info.number, e
                );
            }
        }

        Ok(())
    }

    /// Check if a PR has merge conflicts and attempt to resolve them
    async fn check_and_resolve_conflicts(&self, pr_merge: &PrMerge) -> Result<(), PrMonitorError> {
        // Get the workspace for this PR
        let Some(workspace) = Workspace::find_by_id(&self.db.pool, pr_merge.workspace_id).await?
        else {
            debug!(
                "Workspace {} not found for PR #{}",
                pr_merge.workspace_id, pr_merge.pr_info.number
            );
            return Ok(());
        };

        // Skip archived workspaces
        if workspace.archived {
            debug!(
                "Skipping conflict check for archived workspace {}",
                workspace.id
            );
            return Ok(());
        }

        // Get the task to check if it's in review
        let Some(task) = Task::find_by_id(&self.db.pool, workspace.task_id).await? else {
            debug!("Task {} not found for workspace {}", workspace.task_id, workspace.id);
            return Ok(());
        };

        // Only check for conflicts if task is in review status
        if task.status != TaskStatus::InReview {
            debug!(
                "Skipping conflict check for task {} (status: {:?})",
                task.id, task.status
            );
            return Ok(());
        }

        // Check if there's already a running execution process for this workspace
        // to avoid triggering multiple conflict resolution attempts
        if self.container.has_running_processes(task.id).await.map_err(|e| {
            PrMonitorError::Container(e.to_string())
        })? {
            debug!(
                "Skipping conflict check for workspace {} - execution already in progress",
                workspace.id
            );
            return Ok(());
        }

        // Get the repo for this PR
        let Some(repo) = Repo::find_by_id(&self.db.pool, pr_merge.repo_id).await? else {
            warn!("Repo {} not found for PR #{}", pr_merge.repo_id, pr_merge.pr_info.number);
            return Ok(());
        };

        // Get the worktree path
        let workspace_path = self.container.workspace_to_current_dir(&workspace);
        let worktree_path = workspace_path.join(&repo.name);

        // Check if the worktree path exists
        if !worktree_path.exists() {
            debug!(
                "Worktree path {} does not exist for workspace {}",
                worktree_path.display(),
                workspace.id
            );
            return Ok(());
        }

        // Check if our branch is behind the target branch
        let target_branch = &pr_merge.target_branch_name;
        let (_, behind) = match self.git.get_branch_status(&worktree_path, &workspace.branch, target_branch) {
            Ok(status) => status,
            Err(e) => {
                debug!(
                    "Failed to check branch status for workspace {}: {}",
                    workspace.id, e
                );
                return Ok(());
            }
        };

        // If not behind, no conflicts possible
        if behind == 0 {
            debug!(
                "Branch '{}' is up to date with '{}' for workspace {}",
                workspace.branch, target_branch, workspace.id
            );
            return Ok(());
        }

        info!(
            "Branch '{}' is {} commits behind '{}' for PR #{}, attempting auto-resolution",
            workspace.branch, behind, target_branch, pr_merge.pr_info.number
        );

        // Attempt auto-resolution via rebase
        let resolution = self.try_auto_resolve_conflicts(
            &workspace,
            &repo,
            &worktree_path,
            target_branch,
        ).await;

        match resolution {
            MergeConflictResolution::NoConflicts | MergeConflictResolution::Resolved => {
                info!(
                    "Auto-resolved conflicts for PR #{} (workspace {})",
                    pr_merge.pr_info.number, workspace.id
                );
            }
            MergeConflictResolution::Failed { conflicted_files, message } => {
                warn!(
                    "Auto-resolution failed for PR #{}: {}. Triggering AI conflict resolution.",
                    pr_merge.pr_info.number, message
                );

                // Trigger AI-assisted conflict resolution if there are conflicted files
                if !conflicted_files.is_empty() {
                    if let Err(e) = self.trigger_conflict_resolution_follow_up(
                        &workspace,
                        target_branch,
                        &conflicted_files,
                    ).await {
                        error!(
                            "Failed to trigger AI conflict resolution for PR #{}: {}",
                            pr_merge.pr_info.number, e
                        );
                    }
                }
            }
        }

        Ok(())
    }

    /// Detect merge conflicts and attempt auto-resolution via rebase
    async fn try_auto_resolve_conflicts(
        &self,
        workspace: &Workspace,
        repo: &Repo,
        worktree_path: &PathBuf,
        target_branch: &str,
    ) -> MergeConflictResolution {
        // Check if there are commits on the target branch that aren't in our branch
        let (_, behind) = match self.git.get_branch_status(worktree_path, &workspace.branch, target_branch) {
            Ok(status) => status,
            Err(e) => {
                warn!(
                    "Failed to check branch status for conflict detection: {}",
                    e
                );
                return MergeConflictResolution::NoConflicts;
            }
        };

        // If our branch is not behind the target, there are no conflicts to resolve
        if behind == 0 {
            debug!(
                "Branch '{}' is not behind '{}', no conflicts to resolve",
                workspace.branch, target_branch
            );
            return MergeConflictResolution::NoConflicts;
        }

        info!(
            "Branch '{}' is {} commits behind '{}', attempting to rebase",
            workspace.branch, behind, target_branch
        );

        // Get the base commit that was used when the branch was created
        let base_commit = match self.git.get_base_commit(worktree_path, &workspace.branch, target_branch) {
            Ok(commit) => commit.to_string(),
            Err(e) => {
                warn!("Failed to get base commit for rebase: {}", e);
                // Fall back to using target branch as both old and new base
                target_branch.to_string()
            }
        };

        // Perform the rebase
        match self.git.rebase_branch(
            &repo.path,
            worktree_path,
            target_branch,     // new base
            &base_commit,      // old base
            &workspace.branch, // branch to rebase
        ) {
            Ok(new_commit) => {
                info!(
                    "Successfully rebased branch '{}' onto '{}', new HEAD: {}",
                    workspace.branch, target_branch, new_commit
                );

                // Push the rebased branch (force push required after rebase)
                match self.git.push_to_remote(worktree_path, &workspace.branch, true) {
                    Ok(()) => {
                        info!(
                            "Successfully pushed rebased branch '{}' to remote",
                            workspace.branch
                        );
                        MergeConflictResolution::Resolved
                    }
                    Err(e) => {
                        error!("Failed to push rebased branch: {}", e);
                        MergeConflictResolution::Failed {
                            conflicted_files: vec![],
                            message: format!(
                                "Rebase succeeded but failed to push: {}. You may need to force push manually.",
                                e
                            ),
                        }
                    }
                }
            }
            Err(GitServiceError::MergeConflicts(msg)) => {
                // Rebase failed due to conflicts - get the list of conflicted files
                let conflicted_files = self.git.get_conflicted_files(worktree_path).unwrap_or_default();

                warn!(
                    "Rebase failed with conflicts in {} files: {:?}",
                    conflicted_files.len(), conflicted_files
                );

                // Abort the failed rebase to leave the branch in a clean state
                if let Err(e) = self.git.abort_conflicts(worktree_path) {
                    error!("Failed to abort rebase after conflict: {}", e);
                }

                MergeConflictResolution::Failed {
                    conflicted_files,
                    message: msg,
                }
            }
            Err(e) => {
                error!("Rebase failed with unexpected error: {}", e);

                // Try to abort any in-progress operation
                let _ = self.git.abort_conflicts(worktree_path);

                MergeConflictResolution::Failed {
                    conflicted_files: vec![],
                    message: format!("Failed to rebase: {}", e),
                }
            }
        }
    }

    /// Trigger AI-assisted conflict resolution via coding agent
    async fn trigger_conflict_resolution_follow_up(
        &self,
        workspace: &Workspace,
        target_branch: &str,
        conflicted_files: &[String],
    ) -> Result<(), PrMonitorError> {
        // Get the custom prompt from config, or use default
        let config = self.config.read().await;
        let prompt_template = config
            .pr_conflict_resolution_prompt
            .as_deref()
            .unwrap_or(DEFAULT_CONFLICT_RESOLUTION_PROMPT);

        // Replace placeholders in prompt
        let prompt = prompt_template
            .replace("{target_branch}", target_branch)
            .replace("{conflicted_files}", &conflicted_files.join(", "));

        drop(config); // Release the lock before async operations

        // Get or create a session for this follow-up
        let session =
            match Session::find_latest_by_workspace_id(&self.db.pool, workspace.id).await? {
                Some(s) => s,
                None => {
                    Session::create(
                        &self.db.pool,
                        &CreateSession { executor: None },
                        Uuid::new_v4(),
                        workspace.id,
                    )
                    .await?
                }
            };

        // Get executor profile from the latest coding agent process in this session
        let Some(executor_profile_id) =
            ExecutionProcess::latest_executor_profile_for_session(&self.db.pool, session.id)
                .await?
        else {
            warn!(
                "No executor profile found for session {}, skipping conflict resolution follow-up",
                session.id
            );
            return Ok(());
        };

        // Get latest agent session ID if one exists (for coding agent continuity)
        let latest_agent_session_id = ExecutionProcess::find_latest_coding_agent_turn_session_id(
            &self.db.pool,
            session.id,
        )
        .await?;

        let working_dir = workspace
            .agent_working_dir
            .as_ref()
            .filter(|dir| !dir.is_empty())
            .cloned();

        // Build the action type (follow-up if session exists, otherwise initial)
        let action_type = if let Some(agent_session_id) = latest_agent_session_id {
            ExecutorActionType::CodingAgentFollowUpRequest(CodingAgentFollowUpRequest {
                prompt,
                session_id: agent_session_id,
                executor_profile_id: executor_profile_id.clone(),
                working_dir: working_dir.clone(),
            })
        } else {
            ExecutorActionType::CodingAgentInitialRequest(CodingAgentInitialRequest {
                prompt,
                executor_profile_id: executor_profile_id.clone(),
                working_dir,
            })
        };

        let action = ExecutorAction::new(action_type, None);

        self.container
            .start_execution(
                workspace,
                &session,
                &action,
                &ExecutionProcessRunReason::CodingAgent,
            )
            .await
            .map_err(|e| PrMonitorError::Container(e.to_string()))?;

        info!(
            "Triggered AI conflict resolution for workspace {} (session {})",
            workspace.id, session.id
        );

        Ok(())
    }
}
