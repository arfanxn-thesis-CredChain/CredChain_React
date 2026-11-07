import { describe, expect, it, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Role } from "@shared/auth/role";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useStore } from "@app/store";
import { makeUser, makeNotification } from "@/test/fixtures";
import {
  notificationKeys,
  useNotificationUnreadCount,
  useNotificationsFeed,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "./useNotifications";

describe("useNotifications", () => {
  const mockUser = makeUser({ id: "usr_alice", email: "alice@example.com" });

  beforeEach(() => {
    useStore.setState({ user: mockUser, isAuthenticated: true });
  });

  function queryWrapper() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    return { client, wrapper: Wrapper };
  }

  it("isolates feeds and unread counts by account and current role", async () => {
    const { client, wrapper } = queryWrapper();
    const reviewer = makeUser({ id: "reviewer", role: Role.ISSUER });
    const holder = { ...reviewer, role: Role.HOLDER };
    const other = makeUser({ id: "other", role: Role.HOLDER });
    for (const [user, count] of [
      [reviewer, 3],
      [holder, 1],
      [other, 0],
    ] as const) {
      client.setQueryData(notificationKeys.unreadCount(user.id, user.role), count);
      client.setQueryData(notificationKeys.feed(user.id, user.role, "all", 20), {
        pages: [
          {
            items: [makeNotification({ id: `${user.id}_${user.role}` })],
            total: count,
            next_cursor: null,
          },
        ],
        pageParams: [null],
      });
    }
    client.setDefaultOptions({ queries: { staleTime: Infinity, retry: false } });
    useStore.setState({ user: reviewer });
    const { result } = renderHook(
      () => ({ feed: useNotificationsFeed(), unread: useNotificationUnreadCount() }),
      { wrapper },
    );
    expect(result.current.unread.data).toBe(3);
    expect(result.current.feed.items[0].id).toBe("reviewer_issuer");
    act(() => useStore.setState({ user: holder }));
    expect(result.current.unread.data).toBe(1);
    expect(result.current.feed.items[0].id).toBe("reviewer_holder");
    act(() => useStore.setState({ user: other }));
    expect(result.current.unread.data).toBe(0);
    expect(result.current.feed.items[0].id).toBe("other_holder");
  });

  it.each([
    ["one", false],
    ["all", false],
    ["one", true],
    ["all", true],
  ] as const)(
    "invalidates the captured account for %s read (failure=%s), never pending work",
    async (mode, failure) => {
      const { client, wrapper } = queryWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      let release!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      let started = false;
      server.use(
        http.put(
          mode === "one" ? "*/api/notifications/:id/read" : "*/api/notifications/read-all",
          async () => {
            started = true;
            await blocked;
            if (failure) return HttpResponse.json({}, { status: 500 });
            return HttpResponse.json({
              code: mode === "one" ? 401602 : 401603,
              data: mode === "one" ? makeNotification() : { updated_count: 1 },
            });
          },
        ),
      );
      const { result } = renderHook(
        () => ({ one: useMarkNotificationRead(), all: useMarkAllNotificationsRead() }),
        { wrapper },
      );
      let request!: Promise<unknown>;
      act(() => {
        request =
          mode === "one"
            ? result.current.one.mutateAsync("notification")
            : result.current.all.mutateAsync();
      });
      await waitFor(() => expect(started).toBe(true));
      act(() => useStore.setState({ user: makeUser({ id: "new_account" }) }));
      await act(async () => {
        release();
        if (failure) await expect(request).rejects.toThrow();
        else await request;
      });
      expect(invalidate).toHaveBeenCalledExactlyOnceWith({
        queryKey: notificationKeys.all(mockUser.id),
      });
    },
  );

  describe("useNotificationUnreadCount", () => {
    it("fetches unread count when authenticated", async () => {
      server.use(
        http.get("*/api/notifications/unread-count", () => {
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: { unread_count: 7 },
          });
        }),
      );

      const { result } = renderHook(() => useNotificationUnreadCount(), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe(7);
    });

    it("is disabled when not authenticated", () => {
      useStore.setState({ user: null, isAuthenticated: false });
      const { result } = renderHook(() => useNotificationUnreadCount(), {
        wrapper: TestProviders,
      });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useNotificationsFeed", () => {
    it("fetches feed with cursor pagination and status filter", async () => {
      const page1Item = makeNotification({ id: "notif_1", read_at: null });
      const page2Item = makeNotification({ id: "notif_2", read_at: "2026-06-01T00:00:00Z" });

      let capturedCursor: string | null = null;
      let capturedStatus: string | null = null;

      server.use(
        http.get("*/api/notifications", ({ request }) => {
          const url = new URL(request.url);
          capturedCursor = url.searchParams.get("cursor");
          capturedStatus = url.searchParams.get("status");

          if (!capturedCursor) {
            return HttpResponse.json({
              code: 400100,
              message: "OK",
              data: {
                items: [page1Item],
                total: 2,
                next_cursor: "notif_1",
              },
            });
          }
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: {
              items: [page2Item],
              total: 2,
              next_cursor: null,
            },
          });
        }),
      );

      const { result } = renderHook(() => useNotificationsFeed({ status: "all" }), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.items).toEqual([page1Item]);
      expect(result.current.total).toBe(2);
      expect(result.current.hasNextPage).toBe(true);
      expect(capturedStatus).toBe("all");

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => expect(result.current.items.length).toBe(2));
      expect(result.current.items).toEqual([page1Item, page2Item]);
      expect(capturedCursor).toBe("notif_1");
    });

    it("is disabled when user is logged out", () => {
      useStore.setState({ user: null, isAuthenticated: false });
      const { result } = renderHook(() => useNotificationsFeed({ status: "all" }), {
        wrapper: TestProviders,
      });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useMarkNotificationRead", () => {
    it("marks single notification as read and calls endpoint", async () => {
      let markedId: string | null = null;
      server.use(
        http.put("*/api/notifications/:id/read", ({ params }) => {
          markedId = params.id as string;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: makeNotification({ id: markedId, read_at: "2026-06-20T12:00:00Z" }),
          });
        }),
      );

      const { result } = renderHook(() => useMarkNotificationRead(), {
        wrapper: TestProviders,
      });

      await act(async () => {
        await result.current.mutateAsync("notif_42");
      });

      expect(markedId).toBe("notif_42");
    });
  });

  describe("useMarkAllNotificationsRead", () => {
    it("marks all notifications as read and returns updated count", async () => {
      let called = false;
      server.use(
        http.put("*/api/notifications/read-all", () => {
          called = true;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: { updated_count: 5 },
          });
        }),
      );

      const { result } = renderHook(() => useMarkAllNotificationsRead(), {
        wrapper: TestProviders,
      });

      let res: { updated_count: number } | undefined;
      await act(async () => {
        res = await result.current.mutateAsync();
      });

      expect(called).toBe(true);
      expect(res?.updated_count).toBe(5);
    });
  });
});
