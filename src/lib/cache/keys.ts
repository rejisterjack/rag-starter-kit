/**
 * Cache key definitions with TTLs
 *
 * Centralizes cache key namespaces and expiration times.
 */

export const CACHE_KEYS = {
  /** Workspace membership + role for permission checks (5 min) */
  workspacePermission: (userId: string, workspaceId: string) =>
    `cache:perm:${userId}:${workspaceId}` as const,

  /** Full permission context (5 min) */
  permissionContext: (userId: string, workspaceId: string) =>
    `cache:pctx:${userId}:${workspaceId}` as const,

  /** API key bcrypt verification result (60s) */
  apiKeyValidation: (keyPreview: string) => `cache:apikey:${keyPreview}` as const,

  /** User workspace list (10 min) */
  userWorkspaces: (userId: string) => `cache:uws:${userId}` as const,
} as const;

export const CACHE_TTL = {
  WORKSPACE_PERMISSION: 5 * 60 * 1000,
  PERMISSION_CONTEXT: 5 * 60 * 1000,
  API_KEY_VALIDATION: 60 * 1000,
  USER_WORKSPACES: 10 * 60 * 1000,
} as const;
