import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { makeUser } from "@/test/fixtures";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
import { useReferencePendingCount, useApproveReference } from "./useReferenceData";

const resources = [
  ["credential-types", "credential-types"],
  ["credential-issuer-organizations", "issuer-organizations"],
  ["competencies", "competencies"],
] as const;

describe("reference pending counts", () => {
  beforeEach(() => {
    useStore.setState({ user: makeUser({ role: Role.ISSUER }), isAuthenticated: true });
  });

  it.each(resources)("reads the pending total for %s, not loaded rows", async (resource, path) => {
    let params: URLSearchParams | undefined;
    server.use(
      http.get(`*/api/${path}`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ code: 100200, data: { items: [], total: 17 } });
      }),
    );
    const { result } = renderHook(() => useReferencePendingCount(resource), {
      wrapper: TestProviders,
    });
    await waitFor(() => expect(result.current.data).toBe(17));
    expect(params?.get("limit")).toBe("1");
    expect(params?.getAll("filters")).toEqual(["status=pending"]);
  });

  it("does not request reviewer counts for holders or signed-out users", () => {
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    const { result, rerender } = renderHook(() => useReferencePendingCount("competencies"), {
      wrapper: TestProviders,
    });
    expect(result.current.fetchStatus).toBe("idle");
    act(() => useStore.setState({ user: null, isAuthenticated: false }));
    rerender();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("keeps failures distinct from zero and supports retry", async () => {
    let failed = true;
    server.use(
      http.get("*/api/competencies", () =>
        failed
          ? HttpResponse.json({ message: "failed" }, { status: 500 })
          : HttpResponse.json({ code: 100200, data: { items: [], total: 0 } }),
      ),
    );
    const { result } = renderHook(() => useReferencePendingCount("competencies"), {
      wrapper: TestProviders,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    failed = false;
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.data).toBe(0));
  });

  it("refreshes counts through existing reference mutation invalidation", async () => {
    let total = 2;
    server.use(
      http.get("*/api/competencies", () =>
        HttpResponse.json({ code: 100200, data: { items: [], total } }),
      ),
      http.post("*/api/competencies/:id/approve", () => {
        total--;
        return HttpResponse.json({ code: 100200, data: {} });
      }),
    );
    const { result } = renderHook(
      () => ({
        count: useReferencePendingCount("competencies"),
        approve: useApproveReference("competencies"),
      }),
      { wrapper: TestProviders },
    );
    await waitFor(() => expect(result.current.count.data).toBe(2));
    await act(async () => {
      await result.current.approve.mutateAsync("proposal");
    });
    await waitFor(() => expect(result.current.count.data).toBe(1));
  });
});
