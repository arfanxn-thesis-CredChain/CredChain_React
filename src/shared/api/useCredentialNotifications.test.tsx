import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useStore } from "@app/store";
import { makeUser, makeCredentialNotification } from "@/test/fixtures";
import {
  useCredentialUnreadCount,
  useCredentialNotificationsFeed,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "./useCredentialNotifications";

describe("useCredentialNotifications", () => {
  const mockUser = makeUser({ id: "usr_alice", email: "alice@example.com" });

  beforeEach(() => {
    useStore.setState({ user: mockUser, isAuthenticated: true });
  });

  describe("useCredentialUnreadCount", () => {
    it("fetches unread count when authenticated", async () => {
      server.use(
        http.get("*/api/credential-notifications/unread-count", () => {
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: { unread_count: 7 },
          });
        }),
      );

      const { result } = renderHook(() => useCredentialUnreadCount(), {
        wrapper: TestProviders,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe(7);
    });

    it("is disabled when not authenticated", () => {
      useStore.setState({ user: null, isAuthenticated: false });
      const { result } = renderHook(() => useCredentialUnreadCount(), {
        wrapper: TestProviders,
      });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useCredentialNotificationsFeed", () => {
    it("fetches feed with cursor pagination and status filter", async () => {
      const page1Item = makeCredentialNotification({ id: "notif_1", read_at: null });
      const page2Item = makeCredentialNotification({ id: "notif_2", read_at: "2026-06-01T00:00:00Z" });

      let capturedCursor: string | null = null;
      let capturedStatus: string | null = null;

      server.use(
        http.get("*/api/credential-notifications", ({ request }) => {
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

      const { result } = renderHook(() => useCredentialNotificationsFeed({ status: "all" }), {
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
      const { result } = renderHook(() => useCredentialNotificationsFeed({ status: "all" }), {
        wrapper: TestProviders,
      });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useMarkNotificationRead", () => {
    it("marks single notification as read and calls endpoint", async () => {
      let markedId: string | null = null;
      server.use(
        http.put("*/api/credential-notifications/:id/read", ({ params }) => {
          markedId = params.id as string;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: makeCredentialNotification({ id: markedId, read_at: "2026-06-20T12:00:00Z" }),
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
        http.put("*/api/credential-notifications/read-all", () => {
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
