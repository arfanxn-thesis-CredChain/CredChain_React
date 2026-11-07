import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { useStore } from "@app/store";
import type {
  NotificationDTO,
  NotificationListResponse,
  NotificationReadAllResponse,
  NotificationUnreadCountResponse,
} from "@shared/types/api";

export const notificationKeys = {
  all: (accountId: string) => ["notifications", accountId] as const,
  unreadCount: (accountId: string, role: string) =>
    ["notifications", accountId, role, "unread-count"] as const,
  feed: (accountId: string, role: string, status: "all" | "unread", limit: number) =>
    ["notifications", accountId, role, "feed", status, limit] as const,
};

export function useNotificationUnreadCount() {
  const user = useStore((s) => s.user);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const isEnabled = isAuthenticated && !!user?.id;

  return useQuery({
    queryKey: user?.id
      ? notificationKeys.unreadCount(user.id, user.role)
      : ["notifications", "anonymous", "unread-count"],
    queryFn: async () => {
      const { data } = await api.get<NotificationUnreadCountResponse>(
        "/notifications/unread-count",
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

export interface UseNotificationsFeedOptions {
  status?: "all" | "unread";
  limit?: number;
}

export function useNotificationsFeed(options: UseNotificationsFeedOptions = {}) {
  const status = options.status ?? "all";
  const limit = options.limit ?? 20;

  const user = useStore((s) => s.user);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const isEnabled = isAuthenticated && !!user?.id;

  const query = useInfiniteQuery<NotificationListResponse>({
    queryKey: user?.id
      ? notificationKeys.feed(user.id, user.role, status, limit)
      : ["notifications", "anonymous", "feed", status],
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
      const response = await api.get<NotificationListResponse>("/notifications", {
        params,
        signal,
      });
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
      const response = await api.put<NotificationDTO>(`/notifications/${notificationId}/read`);
      return response.data;
    },
    onMutate: () => {
      return { owningAccountId: user?.id };
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.owningAccountId) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.all(context.owningAccountId),
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
      const response = await api.put<NotificationReadAllResponse>("/notifications/read-all");
      return response.data;
    },
    onMutate: () => {
      return { owningAccountId: user?.id };
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.owningAccountId) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.all(context.owningAccountId),
        });
      }
    },
  });
}
