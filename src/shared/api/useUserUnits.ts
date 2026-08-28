import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import type { HolderUnitDTO } from "@shared/types/api";

export const userUnitKeys = {
  /** Prefix covering every search variant — what mutations invalidate. */
  all: () => ["user-units"] as const,
  list: (search?: string) => ["user-units", { search: search || undefined }] as const,
};

/**
 * The whole tree, optionally filtered by name.
 *
 * A search returns the matched units *plus* their ancestor chain (recursive CTE
 * in gorm_user_unit_repository.go), so the client can still rebuild a tree.
 * Never paginated: a truncated branch renders a structurally broken tree, and
 * the endpoint already defaults to a page size large enough for whole org charts.
 */
export function useUserUnits(search?: string) {
  const term = search?.trim() || undefined;
  return useQuery({
    queryKey: userUnitKeys.list(term),
    queryFn: async () => {
      const response = await api.get<HolderUnitDTO[]>("/user-units", {
        params: term ? { search: term } : undefined,
      });
      return Array.isArray(response.data) ? response.data : [];
    },
  });
}
