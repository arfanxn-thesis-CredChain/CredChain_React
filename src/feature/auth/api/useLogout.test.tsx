import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useStore } from "@app/store";
import { notify } from "@shared/lib/notify";
import { useLogout } from "./useLogout";

vi.mock("@shared/lib/notify", () => ({ notify: { info: vi.fn(), error: vi.fn() } }));

describe("useLogout", () => {
  it("clears local state but does not report successful revocation on server failure", async () => {
    server.use(
      http.post("/api/auth/logout", () => HttpResponse.json({ code: 100050 }, { status: 500 })),
    );
    useStore.setState({ isAuthenticated: true });
    const { result } = renderHook(() => useLogout(), { wrapper: TestProviders });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useStore.getState().isAuthenticated).toBe(false);
    expect(notify.info).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith("system.internal_error");
  });
});
