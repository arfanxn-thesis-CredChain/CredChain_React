import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { referenceKeys } from "@shared/api/useReferenceData";
import { server } from "@/test/msw/server";
import { issuerOrganizationResource } from "./keys";
import {
  useDestroyIssuerOrganization,
  useStoreIssuerOrganization,
  useUpdateIssuerOrganization,
} from "./useMutateIssuerOrganizations";

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
    queryKey: referenceKeys.list(issuerOrganizationResource),
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

describe("useMutateIssuerOrganizations", () => {
  beforeEach(() => {
    mockNotify.success.mockClear();
    mockNotify.error.mockClear();
    mockNotify.info.mockClear();
  });

  it("store POSTs /issuer-organizations with { name }, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string; body?: unknown }[] = [];
    server.use(
      http.post("*/api/issuer-organizations", async ({ request }) => {
        recorded.push({ method: request.method, url: request.url, body: await request.json() });
        return envelope(400901, "Stored", { id: "iorg_new", name: "New Org" });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStoreIssuerOrganization(), { wrapper });

    await result.current.mutateAsync("New Org");

    expect(recorded[0].method).toBe("POST");
    expect(recorded[0].url).toContain("/api/issuer-organizations");
    expect(recorded[0].body).toEqual({ name: "New Org" });
    expect(mockNotify.success).toHaveBeenCalledWith("success_issuer_organization_store");
    await expectInvalidated();
  });

  it("update PUTs /issuer-organizations/:id with { name }, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string; body?: unknown }[] = [];
    server.use(
      http.put("*/api/issuer-organizations/:id", async ({ request, params }) => {
        recorded.push({ method: request.method, url: request.url, body: await request.json() });
        return envelope(400902, "Updated", { id: String(params.id), name: "Renamed" });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateIssuerOrganization(), { wrapper });

    await result.current.mutateAsync({ id: "iorg_01", name: "Renamed" });

    expect(recorded[0].method).toBe("PUT");
    expect(recorded[0].url).toContain("/api/issuer-organizations/iorg_01");
    expect(recorded[0].body).toEqual({ name: "Renamed" });
    expect(mockNotify.success).toHaveBeenCalledWith("success_issuer_organization_update");
    await expectInvalidated();
  });

  it("destroy DELETEs /issuer-organizations/:id, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string }[] = [];
    server.use(
      http.delete("*/api/issuer-organizations/:id", ({ request }) => {
        recorded.push({ method: request.method, url: request.url });
        return envelope(400903, "Destroyed", null);
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDestroyIssuerOrganization(), { wrapper });

    await result.current.mutateAsync("iorg_01");

    expect(recorded[0].method).toBe("DELETE");
    expect(recorded[0].url).toContain("/api/issuer-organizations/iorg_01");
    expect(mockNotify.success).toHaveBeenCalledWith("success_issuer_organization_destroy");
    await expectInvalidated();
  });

  it("toasts the mapped messageKey when the server rejects with a destroy-in-use code", async () => {
    server.use(
      http.put("*/api/issuer-organizations/:id", () =>
        HttpResponse.json({ code: 400742, message: "In use" }, { status: 409 }),
      ),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateIssuerOrganization(), { wrapper });

    await expect(() =>
      result.current.mutateAsync({ id: "iorg_01", name: "Renamed" }),
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(mockNotify.error).toHaveBeenCalledWith("error_issuer_organization_destroy_in_use");
    });
  });
});
