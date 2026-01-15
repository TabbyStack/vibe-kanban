export const paths = {
  /** Main home page */
  home: () => '/',
  /** Full-page attempt logs - used for IDE embedding */
  attemptFull: (projectId: string, taskId: string, attemptId: string) =>
    `/projects/${projectId}/tasks/${taskId}/attempts/${attemptId}/full`,
};
