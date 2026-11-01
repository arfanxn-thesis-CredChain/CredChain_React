import type { PaginationParams } from "@shared/types/api";

export const credentialKeys = {
  all: () => ["credentials"] as const,
  list: (params?: PaginationParams) => ["credentials", "list", params] as const,
  detail: (id: string, includes?: string[]) => ["credentials", "detail", id, includes] as const,
  mine: (params?: PaginationParams) => ["credentials", "mine", params] as const,
  file: (id: string) => ["credentials", "file", id] as const,
};
