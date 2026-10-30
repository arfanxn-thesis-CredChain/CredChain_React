import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import type { CredentialDTO, PaginatedResponse } from "@shared/types/api";

export const PENDING_REVIEW_FILTERS = ["activated_at_", "rejected_at_"];

interface UsePendingReviewCountOptions {
  enabled?: boolean;
}

export function usePendingReviewCount(options?: UsePendingReviewCountOptions) {
  const user = useStore((state) => state.user);
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  const isEnabled = (options?.enabled ?? true) && isAuthenticated && !!user?.id;

  return useQuery({
    queryKey: ["credentials", "pending-count", user?.id, user?.role],
    queryFn: async () => {
      const endpoint = user?.role === Role.HOLDER ? "/users/self/credentials" : "/credentials";
      const { data } = await api.get<PaginatedResponse<CredentialDTO>>(endpoint, {
        params: {
          limit: 1,
          filters: PENDING_REVIEW_FILTERS,
        },
      });
      return data.total;
    },
    enabled: isEnabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
