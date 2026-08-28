import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useUserUnits } from "@shared/api/useUserUnits";

describe("useUserUnits", () => {
  it("fetches user units from /user-units", async () => {
    const { result } = renderHook(() => useUserUnits(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.data?.map((u) => u.name)).toEqual([
        "Faculty of Engineering",
        "Computer Science Department",
      ]);
    });
  });

  it("sends no limit param, so the endpoint's own page size applies", async () => {
    // A truncated response renders a structurally broken tree, so the client
    // must never cap the page size itself.
    let seen: URL | undefined;
    server.use(
      http.get("*/api/user-units", ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json({ code: 100200, message: "OK", data: [] });
      }),
    );

    const { result } = renderHook(() => useUserUnits(), { wrapper: TestProviders });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen?.searchParams.has("limit")).toBe(false);
  });

  it("passes a trimmed search term through", async () => {
    let seen: URL | undefined;
    server.use(
      http.get("*/api/user-units", ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json({ code: 100200, message: "OK", data: [] });
      }),
    );

    const { result } = renderHook(() => useUserUnits("  Engineering  "), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen?.searchParams.get("search")).toBe("Engineering");
  });
});
