import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import {
  useCompetencies,
  useCredentialTypes,
  useIssuerOrganizations,
  useUpsertReference,
} from "./useReferenceData";

describe("useReferenceData", () => {
  it("fetches credential types", async () => {
    const { result } = renderHook(() => useCredentialTypes(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.data?.items.map((i) => i.name)).toEqual([
        "Bachelor's Degree",
        "Professional Certificate",
      ]);
    });
  });

  it("fetches issuer organizations from the backend /issuer-organizations route", async () => {
    const { result } = renderHook(() => useIssuerOrganizations(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.data?.items.map((i) => i.name)).toEqual([
        "University of Indonesia",
        "Tech Academy",
      ]);
    });
  });

  it("fetches competencies", async () => {
    const { result } = renderHook(() => useCompetencies(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.data?.items.map((i) => i.name)).toEqual([
        "Machine Learning",
        "Data Analysis",
      ]);
    });
  });

  it("upsert creates a row and invalidates the list query", async () => {
    let listCalls = 0;
    server.use(
      http.get("*/api/credential-types", () =>
        HttpResponse.json({
          code: 400600,
          message: "Credential types retrieved",
          data: {
            items: [{ id: "ctype_01", name: "Bachelor's Degree" }],
            total: 1,
          },
        }),
      ),
    );

    const { result } = renderHook(
      () => ({
        list: useCredentialTypes(),
        upsert: useUpsertReference("credential-types"),
      }),
      { wrapper: TestProviders },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(listCalls).toBe(0);

    server.use(
      http.get("*/api/credential-types", () => {
        listCalls += 1;
        return HttpResponse.json({
          code: 400600,
          message: "Credential types retrieved",
          data: { items: [{ id: "ctype_01", name: "Bachelor's Degree" }], total: 1 },
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
