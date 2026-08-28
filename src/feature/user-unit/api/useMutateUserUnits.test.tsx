import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { server } from "@/test/msw/server";
import { userUnitKeys } from "@shared/api/useUserUnits";
import {
  useDestroyUserUnit,
  useStoreUserUnit,
  useUpdateUserUnit,
} from "./useMutateUserUnits";

function envelope<T>(code: number, message: string, data?: T) {
  return HttpResponse.json({ code, message, ...(data !== undefined ? { data } : {}) });
}

const mockNotify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@shared/lib/notify", () => ({ notify: mockNotify }));

let probeCount = 0;

function ListProbe() {
  useQuery({
    queryKey: userUnitKeys.all(),
    queryFn: async () => {
      probeCount += 1;
      return [];
    },
  });
  return null;
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ListProbe />
      {children}
    </QueryClientProvider>
  );
  return { queryClient, wrapper };
}

function expectInvalidated() {
  return waitFor(() => {
    expect(probeCount).toBeGreaterThanOrEqual(2);
  });
}

describe("useMutateUserUnits", () => {
  beforeEach(() => {
    mockNotify.success.mockClear();
    mockNotify.error.mockClear();
    mockNotify.info.mockClear();
  });

  it("store POSTs /user-units with { name, parent_id }, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string; body?: unknown }[] = [];
    server.use(
      http.post("*/api/user-units", async ({ request }) => {
        recorded.push({ method: request.method, url: request.url, body: await request.json() });
        return envelope(301001, "Stored", {
          id: "unit_new",
          parent_id: "unit_01",
          name: "Informatics",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: null,
        });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStoreUserUnit(), { wrapper });

    await result.current.mutateAsync({ name: "Informatics", parent_id: "unit_01" });

    expect(recorded[0].method).toBe("POST");
    expect(recorded[0].url).toContain("/api/user-units");
    expect(recorded[0].body).toEqual({ name: "Informatics", parent_id: "unit_01" });
    expect(mockNotify.success).toHaveBeenCalledWith("success_user_unit_store");
    await expectInvalidated();
  });

  it("update PUTs /user-units/:id with only the provided fields", async () => {
    const recorded: { method?: string; url?: string; body?: unknown }[] = [];
    server.use(
      http.put("*/api/user-units/:id", async ({ request, params }) => {
        recorded.push({ method: request.method, url: request.url, body: await request.json() });
        return envelope(301002, "Updated", {
          id: String(params.id),
          parent_id: "unit_01",
          name: "Renamed",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: null,
        });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateUserUnit(), { wrapper });

    await result.current.mutateAsync({ id: "unit_02", name: "Renamed" });

    expect(recorded[0].method).toBe("PUT");
    expect(recorded[0].url).toContain("/api/user-units/unit_02");
    expect(recorded[0].body).toEqual({ name: "Renamed" });
    expect(mockNotify.success).toHaveBeenCalledWith("success_user_unit_update");
    await expectInvalidated();
  });

  it("update PUT includes parent_id when moving a unit", async () => {
    const recorded: { body?: unknown }[] = [];
    server.use(
      http.put("*/api/user-units/:id", async ({ request }) => {
        recorded.push({ body: await request.json() });
        return envelope(301002, "Updated", null);
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateUserUnit(), { wrapper });

    await result.current.mutateAsync({ id: "unit_02", parent_id: "unit_03" });

    expect(recorded[0].body).toEqual({ parent_id: "unit_03" });
  });

  it("update PUT includes active when toggling", async () => {
    const recorded: { body?: unknown }[] = [];
    server.use(
      http.put("*/api/user-units/:id", async ({ request }) => {
        recorded.push({ body: await request.json() });
        return envelope(301002, "Updated", null);
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateUserUnit(), { wrapper });

    await result.current.mutateAsync({ id: "unit_02", active: false });

    expect(recorded[0].body).toEqual({ active: false });
  });

  it("destroy DELETEs /user-units/:id, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string }[] = [];
    server.use(
      http.delete("*/api/user-units/:id", ({ request }) => {
        recorded.push({ method: request.method, url: request.url });
        return envelope(301003, "Destroyed", null);
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDestroyUserUnit(), { wrapper });

    await result.current.mutateAsync("unit_01");

    expect(recorded[0].method).toBe("DELETE");
    expect(recorded[0].url).toContain("/api/user-units/unit_01");
    expect(mockNotify.success).toHaveBeenCalledWith("success_user_unit_destroy");
    await expectInvalidated();
  });

  it("toasts the mapped messageKey when the server rejects with an in-use destroy code", async () => {
    server.use(
      http.delete("*/api/user-units/:id", () =>
        HttpResponse.json({ code: 300650, message: "In use" }, { status: 409 }),
      ),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDestroyUserUnit(), { wrapper });

    await expect(() => result.current.mutateAsync("unit_01")).rejects.toBeDefined();

    await waitFor(() => {
      expect(mockNotify.error).toHaveBeenCalledWith("error_user_unit_destroy_in_use");
    });
  });
});
