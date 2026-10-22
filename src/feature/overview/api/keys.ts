export const overviewKeys = {
  all: (filters?: string[]) => ["overview", { limit: 1, filters }] as const,
  recap: () => ["overview", "credential-recap"] as const,
};
