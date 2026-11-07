import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_SORT_OPTIONS,
  DEFAULT_CREDENTIAL_SORT,
  normalizeCredentialSortParam,
  parseCredentialSort,
} from "./credentialSort";

describe("credentialSort", () => {
  describe("CREDENTIAL_SORT_OPTIONS", () => {
    it("defines the canonical four sort options", () => {
      expect(CREDENTIAL_SORT_OPTIONS).toHaveLength(4);
      expect(CREDENTIAL_SORT_OPTIONS.map((o) => o.value)).toEqual([
        "-lifecycle_at",
        "lifecycle_at",
        "name",
        "-name",
      ]);
      expect(DEFAULT_CREDENTIAL_SORT).toBe("-lifecycle_at");
    });
  });

  describe("parseCredentialSort", () => {
    it("returns default sort for null or empty", () => {
      expect(parseCredentialSort(null)).toBe("-lifecycle_at");
      expect(parseCredentialSort("")).toBe("-lifecycle_at");
    });

    it("parses canonical sort values", () => {
      expect(parseCredentialSort("-lifecycle_at")).toBe("-lifecycle_at");
      expect(parseCredentialSort("lifecycle_at")).toBe("lifecycle_at");
      expect(parseCredentialSort("+lifecycle_at")).toBe("lifecycle_at");
      expect(parseCredentialSort("name")).toBe("name");
      expect(parseCredentialSort("+name")).toBe("name");
      expect(parseCredentialSort("-name")).toBe("-name");
    });

    it("normalizes legacy Newest date-sort values to -lifecycle_at", () => {
      expect(parseCredentialSort("-issued_at")).toBe("-lifecycle_at");
      expect(parseCredentialSort("-revoked_at")).toBe("-lifecycle_at");
      expect(parseCredentialSort("-expires_at")).toBe("-lifecycle_at");
    });

    it("normalizes legacy Oldest date-sort values to lifecycle_at", () => {
      expect(parseCredentialSort("issued_at")).toBe("lifecycle_at");
      expect(parseCredentialSort("+issued_at")).toBe("lifecycle_at");
      expect(parseCredentialSort("revoked_at")).toBe("lifecycle_at");
      expect(parseCredentialSort("+revoked_at")).toBe("lifecycle_at");
      expect(parseCredentialSort("expires_at")).toBe("lifecycle_at");
      expect(parseCredentialSort("+expires_at")).toBe("lifecycle_at");
    });

    it("falls back to default for unsupported values", () => {
      expect(parseCredentialSort("unknown")).toBe("-lifecycle_at");
      expect(parseCredentialSort("invalid_column")).toBe("-lifecycle_at");
    });
  });

  describe("normalizeCredentialSortParam", () => {
    it("keeps URL untouched when sort param is omitted (canonical default)", () => {
      const params = new URLSearchParams("review=approved&page=1");
      const { normalizedSort, updatedParams } = normalizeCredentialSortParam(params, "sort");
      expect(normalizedSort).toBe("-lifecycle_at");
      expect(updatedParams).toBeNull();
    });

    it("removes sort param when default is explicitly passed (?sort=-lifecycle_at)", () => {
      const params = new URLSearchParams("sort=-lifecycle_at&review=all");
      const { normalizedSort, updatedParams } = normalizeCredentialSortParam(params, "sort");
      expect(normalizedSort).toBe("-lifecycle_at");
      expect(updatedParams).not.toBeNull();
      expect(updatedParams?.has("sort")).toBe(false);
      expect(updatedParams?.get("review")).toBe("all");
    });

    it("removes sort param when legacy Newest (?sort=-issued_at) is passed", () => {
      const params = new URLSearchParams("sort=-issued_at&review=pending");
      const { normalizedSort, updatedParams } = normalizeCredentialSortParam(params, "sort");
      expect(normalizedSort).toBe("-lifecycle_at");
      expect(updatedParams).not.toBeNull();
      expect(updatedParams?.has("sort")).toBe(false);
      expect(updatedParams?.get("review")).toBe("pending");
    });

    it("rewrites legacy Oldest (?sort=issued_at) to ?sort=lifecycle_at", () => {
      const params = new URLSearchParams("sort=issued_at&review=all");
      const { normalizedSort, updatedParams } = normalizeCredentialSortParam(params, "sort");
      expect(normalizedSort).toBe("lifecycle_at");
      expect(updatedParams).not.toBeNull();
      expect(updatedParams?.get("sort")).toBe("lifecycle_at");
      expect(updatedParams?.get("review")).toBe("all");
    });

    it("rewrites legacy revoked_at and expires_at to lifecycle_at", () => {
      const p1 = new URLSearchParams("sort=revoked_at");
      expect(normalizeCredentialSortParam(p1, "sort").updatedParams?.get("sort")).toBe(
        "lifecycle_at",
      );

      const p2 = new URLSearchParams("sort=expires_at");
      expect(normalizeCredentialSortParam(p2, "sort").updatedParams?.get("sort")).toBe(
        "lifecycle_at",
      );
    });

    it("does not rewrite canonical Oldest (?sort=lifecycle_at)", () => {
      const params = new URLSearchParams("sort=lifecycle_at&review=revoked");
      const { normalizedSort, updatedParams } = normalizeCredentialSortParam(params, "sort");
      expect(normalizedSort).toBe("lifecycle_at");
      expect(updatedParams).toBeNull();
    });

    it("does not rewrite name sorts (?sort=name, ?sort=-name)", () => {
      const p1 = new URLSearchParams("sort=name");
      expect(normalizeCredentialSortParam(p1, "sort").updatedParams).toBeNull();

      const p2 = new URLSearchParams("sort=-name");
      expect(normalizeCredentialSortParam(p2, "sort").updatedParams).toBeNull();
    });

    it("removes invalid sort parameter and falls back to default", () => {
      const params = new URLSearchParams("sort=invalid_column&search=test");
      const { normalizedSort, updatedParams } = normalizeCredentialSortParam(params, "sort");
      expect(normalizedSort).toBe("-lifecycle_at");
      expect(updatedParams).not.toBeNull();
      expect(updatedParams?.has("sort")).toBe(false);
      expect(updatedParams?.get("search")).toBe("test");
    });

    it("supports custom parameter name for UserDetail (credential_sort)", () => {
      const params = new URLSearchParams("credential_sort=issued_at&credential_status=active");
      const { normalizedSort, updatedParams } = normalizeCredentialSortParam(
        params,
        "credential_sort",
      );
      expect(normalizedSort).toBe("lifecycle_at");
      expect(updatedParams?.get("credential_sort")).toBe("lifecycle_at");
      expect(updatedParams?.get("credential_status")).toBe("active");
    });
  });
});
