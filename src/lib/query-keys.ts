export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (filters?: { status?: string }) => [...documentKeys.lists(), filters] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
};

export const chatKeys = {
  all: ['chats'] as const,
  lists: () => [...chatKeys.all, 'list'] as const,
  detail: (id: string) => [...chatKeys.all, 'detail', id] as const,
};

export const branchKeys = {
  all: ['branches'] as const,
  list: (conversationId: string) => [...branchKeys.all, 'list', conversationId] as const,
  compare: (a: string, b: string) => [...branchKeys.all, 'compare', a, b] as const,
};

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  list: (workspaceId: string) => [...apiKeyKeys.all, 'list', workspaceId] as const,
  usage: (keyId: string, days: number) => [...apiKeyKeys.all, 'usage', keyId, days] as const,
};

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (filter: Record<string, unknown>) =>
    [...analyticsKeys.all, 'overview', filter] as const,
  metrics: (filter: Record<string, unknown>) => [...analyticsKeys.all, 'metrics', filter] as const,
  timeSeries: (filter: Record<string, unknown>) =>
    [...analyticsKeys.all, 'timeseries', filter] as const,
  realtime: () => [...analyticsKeys.all, 'realtime'] as const,
  events: () => [...analyticsKeys.all, 'events'] as const,
};
