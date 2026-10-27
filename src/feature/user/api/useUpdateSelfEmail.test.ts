import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { makeUser } from "@/test/fixtures";
import { useStore } from "@app/store";
import { useUpdateSelfEmail } from "./useUpdateSelfEmail";

describe("useUpdateSelfEmail", () => {
  beforeEach(() => {
    useStore.setState({ user: null, isAuthenticated: false });
  });

  it("keeps the current user fields when the backend returns only the new email", async () => {
    const current = makeUser({ name: "Jane", unit_id: "unit_02", joined_year: 2025 });
    useStore.setState({ user: current, isAuthenticated: true });
    let body: unknown;
    server.use(
      http.put("*/api/users/self/email", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          code: 300801,
          message: "ok",
          data: { email: "new@example.com" },
        });
      }),
    );

    const { result } = renderHook(() => useUpdateSelfEmail(), { wrapper: TestProviders });
    result.current.mutate({ email: "new@example.com", id_token: "google-id-token" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(body).toEqual({ email: "new@example.com", id_token: "google-id-token" });
    expect(useStore.getState().user).toEqual({ ...current, email: "new@example.com" });
  });
});
