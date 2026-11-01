import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { useStore } from "@app/store";
import type {
  CredentialNotificationDTO,
  CredentialNotificationListResponse,
  CredentialNotificationReadAllResponse,
  CredentialNotificationUnreadCountResponse,
} from "@shared/types/api";

export const credentialNotificationKeys = {
  all: (accountId: string) => ["credential-notifications", accountId] as const,
  unreadCount: (accountId: string) => ["credential-notifications", accountId, "unread-count"] as const,
  feed: (accountId: string, status: "all" | "unread") =>
    ["credential-notifications", accountId, "feed", status] as const,
};

export function useCredentialUnreadCount() {
  const user = useStore((s) => s.user);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const isEnabled = isAuthenticated && !!user?.id;

  return useQuery({
    queryKey: user?.id ? credentialNotificationKeys.unreadCount(user.id) : ["credential-notifications", "anonymous", "unread-count"],
    queryFn: async () => {
      const { data } = await api.get<CredentialNotificationUnreadCountResponse>(
        "/credential-notifications/unread-count",
      );
      return data.unread_count;
    },
    enabled: isEnabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export interface UseCredentialNotificationsFeedOptions {
  status?: "all" | "unread";
  limit?: number;
}

export function useCredentialNotificationsFeed(options: UseCredentialNotificationsFeedOptions = {}) {
  const status = options.status ?? "all";
  const limit = options.limit ?? 20;

  const user = useStore((s) => s.user);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const isEnabled = isAuthenticated && !!user?.id;

  const query = useInfiniteQuery<CredentialNotificationListResponse>({
    queryKey: user?.id
      ? credentialNotificationKeys.feed(user.id, status)
      : ["credential-notifications", "anonymous", "feed", status],
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    queryFn: async ({ pageParam, signal }) => {
      const params: Record<string, unknown> = {
        status,
        limit,
      };
      if (pageParam) {
        params.cursor = pageParam;
      }
      const response = await api.get<CredentialNotificationListResponse>(
        "/credential-notifications",
        {
          params,
          signal,
        },
      );
      return response.data;
    },
    enabled: isEnabled,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const items = [
    ...new Map(
      query.data?.pages.flatMap((page) => page.items).map((row) => [row.id, row]),
    ).values(),
  ];

  return {
    ...query,
    items,
    total: query.data?.pages[0]?.total ?? 0,
  };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const user = useStore((s) => s.user);

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await api.put<CredentialNotificationDTO>(
        `/credential-notifications/${notificationId}/read`,
      );
      return response.data;
    },
    onMutate: () => {
      return { owningAccountId: user?.id };
    },
    onSuccess: (_data, _variables, context) => {
      if (context?.owningAccountId) {
        queryClient.invalidateQueries({
          queryKey: credentialNotificationKeys.all(context.owningAccountId),
        });
      }
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const user = useStore((s) => s.user);

  return useMutation({
    mutationFn: async () => {
      const response = await api.put<CredentialNotificationReadAllResponse>(
        "/credential-notifications/read-all",
      );
      return response.data;
    },
    onMutate: () => {
      return { owningAccountId: user?.id };
    },
    onSuccess: (_data, _variables, context) => {
      if (context?.owningAccountId) {
        queryClient.invalidateQueries({
          queryKey: credentialNotificationKeys.all(context.owningAccountId),
        });
      }
    },
  });
}
