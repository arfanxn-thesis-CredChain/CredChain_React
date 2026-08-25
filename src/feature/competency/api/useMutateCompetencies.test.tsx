import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { referenceKeys } from "@shared/api/useReferenceData";
import { server } from "@/test/msw/server";
import { competencyResource } from "./keys";
import {
  useDestroyCompetency,
  useStoreCompetency,
  useUpdateCompetency,
} from "./useMutateCompetencies";

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
    queryKey: referenceKeys.all(competencyResource),
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

describe("useMutateCompetencies", () => {
  beforeEach(() => {
    mockNotify.success.mockClear();
    mockNotify.error.mockClear();
    mockNotify.info.mockClear();
  });

  it("store POSTs /competencies with { name }, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string; body?: unknown }[] = [];
    server.use(
      http.post("*/api/competencies", async ({ request }) => {
        recorded.push({ method: request.method, url: request.url, body: await request.json() });
        return envelope(401001, "Stored", { id: "comp_new", name: "Leadership" });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStoreCompetency(), { wrapper });

    await result.current.mutateAsync("Leadership");

    expect(recorded[0].method).toBe("POST");
    expect(recorded[0].url).toContain("/api/competencies");
    expect(recorded[0].body).toEqual({ name: "Leadership" });
    expect(mockNotify.success).toHaveBeenCalledWith("success_competency_store");
    await expectInvalidated();
  });

  it("update PUTs /competencies/:id with { name }, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string; body?: unknown }[] = [];
    server.use(
      http.put("*/api/competencies/:id", async ({ request, params }) => {
        recorded.push({ method: request.method, url: request.url, body: await request.json() });
        return envelope(401002, "Updated", { id: String(params.id), name: "Renamed" });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCompetency(), { wrapper });

    await result.current.mutateAsync({ id: "comp_01", name: "Renamed" });

    expect(recorded[0].method).toBe("PUT");
    expect(recorded[0].url).toContain("/api/competencies/comp_01");
    expect(recorded[0].body).toEqual({ name: "Renamed" });
    expect(mockNotify.success).toHaveBeenCalledWith("success_competency_update");
    await expectInvalidated();
  });

  it("destroy DELETEs /competencies/:id, toasts success and invalidates", async () => {
    const recorded: { method?: string; url?: string }[] = [];
    server.use(
      http.delete("*/api/competencies/:id", ({ request }) => {
        recorded.push({ method: request.method, url: request.url });
        return envelope(401003, "Destroyed", null);
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDestroyCompetency(), { wrapper });

    await result.current.mutateAsync("comp_01");

    expect(recorded[0].method).toBe("DELETE");
    expect(recorded[0].url).toContain("/api/competencies/comp_01");
    expect(mockNotify.success).toHaveBeenCalledWith("success_competency_destroy");
    await expectInvalidated();
  });

  it("toasts the mapped messageKey when the server rejects with a destroy-in-use code", async () => {
    server.use(
      http.put("*/api/competencies/:id", () =>
        HttpResponse.json({ code: 400743, message: "In use" }, { status: 409 }),
      ),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCompetency(), { wrapper });

    await expect(() =>
      result.current.mutateAsync({ id: "comp_01", name: "Renamed" }),
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(mockNotify.error).toHaveBeenCalledWith("error_competency_destroy_in_use");
    });
  });
});
