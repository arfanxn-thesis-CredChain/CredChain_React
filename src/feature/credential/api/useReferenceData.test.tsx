import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import {
  useCompetencies,
  useCredentialTypes,
  useIssuerOrganizations,
  useReferenceByIds,
  useUpsertReference,
} from "./useReferenceData";

describe("useReferenceData", () => {
  it("fetches credential types", async () => {
    const { result } = renderHook(() => useCredentialTypes(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.items.map((i) => i.name)).toEqual([
        "Bachelor's Degree",
        "Professional Certificate",
      ]);
    });
  });

  it("fetches issuer organizations from the backend /issuer-organizations route", async () => {
    const { result } = renderHook(() => useIssuerOrganizations(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.items.map((i) => i.name)).toEqual([
        "University of Indonesia",
        "Tech Academy",
      ]);
    });
  });

  it("fetches competencies", async () => {
    const { result } = renderHook(() => useCompetencies(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.items.map((i) => i.name)).toEqual([
        "Machine Learning",
        "Data Analysis",
      ]);
    });
  });

  it("sends the search term to the server rather than filtering locally", async () => {
    let seenSearch: string | null = null;
    server.use(
      http.get("*/api/credential-types", ({ request }) => {
        seenSearch = new URL(request.url).searchParams.get("search");
        return HttpResponse.json({
          code: 400600,
          message: "Credential types retrieved",
          data: {
            items: [{ id: "ctype_02", name: "Professional Certificate" }],
            total: 1,
            page: 1,
            limit: 100,
            last_page: 1,
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

    const { result } = renderHook(() => useCredentialTypes({ search: "profess" }), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(seenSearch).toBe("profess");
  });

  it("resolves rows by id through the IN filter", async () => {
    const { result } = renderHook(() => useReferenceByIds("competencies", ["comp_02"]), {
      wrapper: TestProviders,
    });

    await waitFor(() => {
      expect(result.current.data?.map((r) => r.name)).toEqual(["Data Analysis"]);
    });
  });

  it("does not fetch by id when nothing is selected", () => {
    const { result } = renderHook(() => useReferenceByIds("competencies", []), {
      wrapper: TestProviders,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("upsert creates a row and invalidates every cached page", async () => {
    let listCalls = 0;

    const { result } = renderHook(
      () => ({
        list: useCredentialTypes(),
        upsert: useUpsertReference("credential-types"),
      }),
      { wrapper: TestProviders },
    );

    await waitFor(() => expect(result.current.list.items.length).toBeGreaterThan(0));

    server.use(
      http.get("*/api/credential-types", () => {
        listCalls += 1;
        return HttpResponse.json({
          code: 400600,
          message: "Credential types retrieved",
          data: {
            items: [{ id: "ctype_01", name: "Bachelor's Degree" }],
            total: 1,
            page: 1,
            limit: 100,
            last_page: 1,
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

    result.current.upsert.mutate("Blockchain Architect");

    await waitFor(() => {
      expect(result.current.upsert.isSuccess).toBe(true);
    });
    await waitFor(() => {
      expect(listCalls).toBeGreaterThan(0);
    });
  });
});
