import { describe, expect, it } from "vitest";
import { isEligibleFor } from "./credentialEligibility";
import type { CredentialStatus, ExtractState } from "@shared/types/api";

function stub(status: CredentialStatus, extract_state: ExtractState = "unextracted") {
  return { status, extract_state };
}

describe("isEligibleFor", () => {
  describe("revoke", () => {
    it("permits approved credentials only", () => {
      expect(isEligibleFor(stub("approved"), "revoke")).toBe(true);
      expect(isEligibleFor(stub("pending"), "revoke")).toBe(false);
      expect(isEligibleFor(stub("rejected"), "revoke")).toBe(false);
      expect(isEligibleFor(stub("revoked"), "revoke")).toBe(false);
    });
  });

  describe("reextract", () => {
    it("permits failed extraction only", () => {
      expect(isEligibleFor(stub("approved", "failed"), "reextract")).toBe(true);
      expect(isEligibleFor(stub("approved", "succeeded"), "reextract")).toBe(false);
      expect(isEligibleFor(stub("approved", "pending"), "reextract")).toBe(false);
      expect(isEligibleFor(stub("approved", "unextracted"), "reextract")).toBe(false);
    });
  });

  describe("approve", () => {
    it("permits pending credentials only", () => {
      expect(isEligibleFor(stub("pending"), "approve")).toBe(true);
      expect(isEligibleFor(stub("approved"), "approve")).toBe(false);
      expect(isEligibleFor(stub("rejected"), "approve")).toBe(false);
      expect(isEligibleFor(stub("revoked"), "approve")).toBe(false);
    });
  });

  describe("reject", () => {
    it("permits pending credentials only", () => {
      expect(isEligibleFor(stub("pending"), "reject")).toBe(true);
      expect(isEligibleFor(stub("approved"), "reject")).toBe(false);
      expect(isEligibleFor(stub("rejected"), "reject")).toBe(false);
      expect(isEligibleFor(stub("revoked"), "reject")).toBe(false);
    });
  });

  describe("null/unknown mode", () => {
    it("returns false", () => {
      expect(isEligibleFor(stub("approved"), null)).toBe(false);
      expect(isEligibleFor(stub("pending"), null)).toBe(false);
    });
  });
});
