import { describe, expect, it } from "vitest";
import { ineligibilityReason, isEligibleFor } from "./credentialEligibility";
import type { CredentialDTO, CredentialStatus, ExtractState } from "@shared/types/api";

type EligibilityCredential = Pick<
  CredentialDTO,
  | "status"
  | "activated_at"
  | "extract_state"
  | "unresolved_metadata"
  | "file_uri"
  | "type"
  | "issuer_organization"
  | "competencies"
>;

function stub(
  status: CredentialStatus,
  extract_state: ExtractState = "unextracted",
  overrides: Partial<EligibilityCredential> = {},
): EligibilityCredential {
  return {
    status,
    activated_at: status === "approved" ? "2026-01-01T00:00:00Z" : null,
    extract_state,
    unresolved_metadata: [],
    file_uri: "ipfs://document",
    ...overrides,
  };
}

describe("isEligibleFor", () => {
  it("allows approved and previously activated expired credentials to be revoked", () => {
    expect(isEligibleFor(stub("approved"), "revoke")).toBe(true);
    expect(
      isEligibleFor(
        stub("expired", "unextracted", { activated_at: "2026-01-01T00:00:00Z" }),
        "revoke",
      ),
    ).toBe(true);
  });

  it("blocks revocation of unactivated, rejected, and already revoked credentials", () => {
    for (const status of ["pending", "rejected", "revoked", "expired"] as const) {
      expect(isEligibleFor(stub(status), "revoke")).toBe(false);
    }
    expect(isEligibleFor(stub("approved", "unextracted", { activated_at: null }), "revoke")).toBe(
      false,
    );
    expect(
      isEligibleFor(
        stub("rejected", "unextracted", { activated_at: "2026-01-01T00:00:00Z" }),
        "revoke",
      ),
    ).toBe(false);
  });

  it("requires failed extraction and a file URI for re-extraction", () => {
    expect(isEligibleFor(stub("approved", "failed"), "reextract")).toBe(true);
    expect(isEligibleFor(stub("approved", "failed", { file_uri: null }), "reextract")).toBe(false);
    expect(isEligibleFor(stub("approved", "failed", { file_uri: "" }), "reextract")).toBe(false);
    expect(
      ineligibilityReason(stub("approved", "failed", { file_uri: null }), "reextract"),
    ).toEqual({ kind: "missing_file" });
    for (const state of ["succeeded", "pending", "unextracted"] as const) {
      expect(isEligibleFor(stub("approved", state), "reextract")).toBe(false);
    }
  });

  it("requires resolved metadata for approval but permits rejection of unresolved submissions", () => {
    const unresolved = stub("pending", "unextracted", {
      unresolved_metadata: ["type", "issuer_organization", "competency"],
    });
    expect(isEligibleFor(stub("pending"), "approve")).toBe(true);
    expect(isEligibleFor(unresolved, "approve")).toBe(false);
    expect(ineligibilityReason(unresolved, "approve")).toEqual({
      kind: "unresolved",
      fields: ["type", "issuer_organization", "competency"],
    });
    expect(isEligibleFor(unresolved, "reject")).toBe(true);
    for (const status of ["approved", "rejected", "revoked", "expired"] as const) {
      expect(isEligibleFor(stub(status), "approve")).toBe(false);
      expect(isEligibleFor(stub(status), "reject")).toBe(false);
    }
  });

  it("blocks known inactive taxonomy rows without treating absent expansions as inactive", () => {
    for (const overrides of [
      { type: { id: "type", name: "Type", active: false } },
      { issuer_organization: { id: "org", name: "Organization", active: false } },
      { competencies: [{ id: "comp", name: "Competency", active: false }] },
    ]) {
      expect(isEligibleFor(stub("pending", "unextracted", overrides), "approve")).toBe(false);
    }
    expect(
      ineligibilityReason(
        stub("pending", "unextracted", {
          type: { id: "type", name: "Type", active: false },
        }),
        "approve",
      ),
    ).toEqual({ kind: "inactive", fields: ["type"] });
    expect(isEligibleFor(stub("pending"), "approve")).toBe(true);
    expect(
      isEligibleFor(
        stub("pending", "unextracted", {
          type: { id: "type", name: "Type" },
        }),
        "approve",
      ),
    ).toBe(true);
  });

  it("does not allow selection without a mode", () => {
    expect(isEligibleFor(stub("approved"), null)).toBe(false);
  });
});
