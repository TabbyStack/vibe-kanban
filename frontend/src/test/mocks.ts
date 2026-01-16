import type { Session, Workspace, TaskWithAttemptStatus } from 'shared/types';
import type { WorkspaceWithSession } from '@/types/attempt';
import type { PatchTypeWithKey } from '@/hooks/useConversationHistory';

/**
 * Creates a mock Session object for testing
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'mock-session-id',
    workspace_id: 'mock-workspace-id',
    executor: 'claude',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock Workspace object for testing
 */
export function createMockWorkspace(
  overrides: Partial<Workspace> = {}
): Workspace {
  return {
    id: 'mock-workspace-id',
    task_id: 'mock-task-id',
    container_ref: 'mock-container-ref',
    branch: 'feature/mock-branch',
    agent_working_dir: '/mock/working/dir',
    setup_completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived: false,
    pinned: false,
    name: null,
    ...overrides,
  };
}

/**
 * Creates a mock WorkspaceWithSession object for testing
 */
export function createMockWorkspaceWithSession(
  workspaceOverrides: Partial<Workspace> = {},
  sessionOverrides: Partial<Session> = {}
): WorkspaceWithSession {
  const workspace = createMockWorkspace(workspaceOverrides);
  const session = createMockSession({
    workspace_id: workspace.id,
    ...sessionOverrides,
  });
  return {
    ...workspace,
    session,
  };
}

/**
 * Creates a mock TaskWithAttemptStatus object for testing
 */
export function createMockTask(
  overrides: Partial<TaskWithAttemptStatus> = {}
): TaskWithAttemptStatus {
  return {
    id: 'mock-task-id',
    title: 'Mock Task',
    description: 'A mock task for testing',
    status: 'inprogress',
    priority: 'medium',
    project_id: 'mock-project-id',
    shared_task_id: null,
    due_date: null,
    position: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // AttemptStatus fields
    has_active_attempt: true,
    latest_attempt_id: 'mock-workspace-id',
    latest_attempt_is_running: false,
    latest_attempt_is_errored: false,
    total_attempt_count: 1,
    ...overrides,
  } as TaskWithAttemptStatus;
}

/**
 * Creates mock conversation entries for testing
 */
export function createMockEntries(count = 3): PatchTypeWithKey[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'NORMALIZED_ENTRY' as const,
    patchKey: `entry-${i}`,
    executionProcessId: 'mock-process-id',
    content: {
      timestamp: new Date().toISOString(),
      entry_type: {
        type: 'assistant_message' as const,
      },
      content: `Mock message ${i}`,
    },
  }));
}

/**
 * Mock entries context value
 */
export const mockEntriesContext = {
  entries: [] as PatchTypeWithKey[],
  setEntries: () => {},
  reset: () => {},
};

/**
 * Mock approval feedback context value
 */
export const mockApprovalFeedbackContext = {
  activeApproval: null,
  enterFeedbackMode: () => {},
  exitFeedbackMode: () => {},
  submitFeedback: async () => {},
  isSubmitting: false,
  error: null,
  isTimedOut: false,
};

/**
 * Mock message edit context value
 */
export const mockMessageEditContext = {
  activeEdit: null,
  startEdit: () => {},
  cancelEdit: () => {},
  isEntryGreyed: () => false,
  isInEditMode: false,
};

/**
 * Mock retry UI context value
 */
export const mockRetryUiContext = {
  activeRetryProcessId: null,
  setActiveRetryProcessId: () => {},
  processOrder: {},
  isProcessGreyed: () => false,
};
