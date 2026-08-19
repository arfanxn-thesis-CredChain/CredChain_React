import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { referenceKeys } from "@shared/api/useReferenceData";
import { server } from "@/test/msw/server";
import { credentialTypeResource } from "./keys";
import {
  useDestroyCredentialType,
  useStoreCredentialType,
  useUpdateCredentialType,
} from "./useMutateCredentialTypes";

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

function ListProbe() {
  useQuery({
    queryKey: referenceKeys.list(credentialTypeResource),
    queryFn: async () => {
      probeCount += 1;
      return [];
    },
  });
  return null;
}

function expectInvalidated() {
  return waitFor(() => {
    expect(probeCount).toBeGreaterThanOrEqual(2);
  });
}

describe("useMutateCredentialTypes", () => {
  beforeEach(() => {
    probeCount = 0;
    mockNotify.success.mockClear();
    mockNotify.error.mockClear();
    mockNotify.info.mockClear();
  });

  it("store POSTs /credential-types with { name }, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string; body?: unknown }[] = [];
    server.use(
      http.post("*/api/credential-types", async ({ request }) => {
        recorded.push({ method: request.method, url: request.url, body: await request.json() });
        return envelope(400801, "Stored", { id: "ctype_new", name: "Diploma" });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStoreCredentialType(), { wrapper });

    await result.current.mutateAsync("Diploma");

    expect(recorded[0].method).toBe("POST");
    expect(recorded[0].url).toContain("/api/credential-types");
    expect(recorded[0].body).toEqual({ name: "Diploma" });
    expect(mockNotify.success).toHaveBeenCalledWith("success_credential_type_store");
    await expectInvalidated();
  });

  it("update PUTs /credential-types/:id with { name, active }, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string; body?: unknown }[] = [];
    server.use(
      http.put("*/api/credential-types/:id", async ({ request, params }) => {
        recorded.push({ method: request.method, url: request.url, body: await request.json() });
        return envelope(400802, "Updated", { id: String(params.id), name: "Renamed", active: false });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCredentialType(), { wrapper });

    await result.current.mutateAsync({ id: "ctype_01", name: "Renamed", active: false });

    expect(recorded[0].method).toBe("PUT");
    expect(recorded[0].url).toContain("/api/credential-types/ctype_01");
    expect(recorded[0].body).toEqual({ name: "Renamed", active: false });
    expect(mockNotify.success).toHaveBeenCalledWith("success_credential_type_update");
    await expectInvalidated();
  });

  it("destroy DELETEs /credential-types/:id, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string }[] = [];
    server.use(
      http.delete("*/api/credential-types/:id", ({ request }) => {
        recorded.push({ method: request.method, url: request.url });
        return envelope(400803, "Destroyed", null);
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDestroyCredentialType(), { wrapper });

    await result.current.mutateAsync("ctype_01");

    expect(recorded[0].method).toBe("DELETE");
    expect(recorded[0].url).toContain("/api/credential-types/ctype_01");
    expect(mockNotify.success).toHaveBeenCalledWith("success_credential_type_destroy");
    await expectInvalidated();
  });

  it("toasts the mapped messageKey when the server rejects with a destroy-in-use code", async () => {
    server.use(
      http.put("*/api/credential-types/:id", () =>
        HttpResponse.json({ code: 400741, message: "In use" }, { status: 409 }),
      ),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCredentialType(), { wrapper });

    await expect(() =>
      result.current.mutateAsync({ id: "ctype_01", name: "Diploma", active: false }),
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(mockNotify.error).toHaveBeenCalledWith("error_credential_type_destroy_in_use");
    });
  });
});
