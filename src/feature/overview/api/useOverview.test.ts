import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TestProviders } from "@/test/TestProviders";
import { makeUser } from "@/test/fixtures";
import { Role } from "@shared/auth/role";
import { useOverview } from "./useOverview";
import type { OverviewDTO } from "@shared/types/api";

const mockData: OverviewDTO = {
  credential_counts: { total: 10, active: 8, revoked: 2, pending: 0, failed: 0 },
  user_counts: { total: 5, holder: 3, issuer: 1, admin: 1, super_admin: 0, active: 5, trashed: 0 },
  recents: {
    active_credentials: [
      {
        id: "c1",
        name: "Degree",
        issuer: makeUser({ id: "i1", name: "UI", email: "ui@test.com", role: Role.ISSUER }),
        issued_at: "2026-06-20T10:00:00Z",
      },
    ],
    revoked_credentials: [],
    stored_users: [],
  },
  chain_details: {
    authority_contract: "0x9A",
    registry_contract: "0x8B",
    last_block: 100,
    relayer_address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    relayer_balance: "10499.98",
  },
};

const server = setupServer(
  http.get("*/api/overview", () => HttpResponse.json({ code: 100100, data: mockData })),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useOverview", () => {
  it("returns overview data on success", async () => {
    const { result } = renderHook(() => useOverview(), { wrapper: TestProviders });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it("returns error on server failure", async () => {
    server.use(
      http.get("*/api/overview", () =>
        HttpResponse.json({ code: 100150, message: "error" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useOverview(), { wrapper: TestProviders });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("passes filters to query params", async () => {
    let capturedParams: URLSearchParams | null = null;
    server.use(
      http.get("*/api/overview", ({ request }) => {
        capturedParams = new URL(request.url).searchParams;
        return HttpResponse.json({ code: 100100, data: mockData });
      }),
    );
    const { result } = renderHook(() => useOverview({ filters: ["date..2026-01-01,2026-06-30"] }), {
      wrapper: TestProviders,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedParams!.getAll("filters")).toEqual(["date..2026-01-01,2026-06-30"]);
  });
});
