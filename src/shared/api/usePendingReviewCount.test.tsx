import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { makeUser } from "@/test/fixtures";
import { usePendingReviewCount, PENDING_REVIEW_FILTERS } from "./usePendingReviewCount";

describe("usePendingReviewCount", () => {
  beforeEach(() => {
    useStore.setState({
      user: makeUser({ id: "usr_issuer", role: Role.ISSUER }),
      isAuthenticated: true,
    });
  });

  it("queries /credentials for Issuer+ with PENDING_REVIEW_FILTERS and limit=1", async () => {
    let requestedUrl: URL | undefined;
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json({
          code: 400100,
          message: "OK",
          data: {
            items: [],
            total: 42,
            page: 1,
            limit: 1,
            last_page: 42,
            from: 1,
            to: 1,
            first_page_url: null,
            last_page_url: null,
            next_page_url: null,
            prev_page_url: null,
          },
        });
      }),
    );

    const { result } = renderHook(() => usePendingReviewCount(), { wrapper: TestProviders });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(42);
    expect(requestedUrl?.searchParams.get("limit")).toBe("1");
    expect(requestedUrl?.searchParams.getAll("filters")).toEqual(PENDING_REVIEW_FILTERS);
  });

  it("queries /users/self/credentials for Holder", async () => {
    useStore.setState({
      user: makeUser({ id: "usr_holder", role: Role.HOLDER }),
      isAuthenticated: true,
    });

    let requestedUrl: URL | undefined;
    server.use(
      http.get("*/api/users/self/credentials", ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json({
          code: 400100,
          message: "OK",
          data: {
            items: [],
            total: 3,
            page: 1,
            limit: 1,
            last_page: 3,
            from: 1,
            to: 1,
            first_page_url: null,
            last_page_url: null,
            next_page_url: null,
            prev_page_url: null,
          },
        });
      }),
    );

    const { result } = renderHook(() => usePendingReviewCount(), { wrapper: TestProviders });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(3);
    expect(requestedUrl?.pathname.endsWith("/users/self/credentials")).toBe(true);
  });

  it("is disabled when not authenticated or explicitly disabled", () => {
    useStore.setState({ user: null, isAuthenticated: false });

    const { result } = renderHook(() => usePendingReviewCount(), { wrapper: TestProviders });
    expect(result.current.fetchStatus).toBe("idle");

    useStore.setState({
      user: makeUser({ id: "usr_issuer", role: Role.ISSUER }),
      isAuthenticated: true,
    });
    const { result: disabledResult } = renderHook(
      () => usePendingReviewCount({ enabled: false }),
      { wrapper: TestProviders },
    );
    expect(disabledResult.current.fetchStatus).toBe("idle");
  });
});
