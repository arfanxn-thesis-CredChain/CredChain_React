import type { CredentialDTO } from "@shared/types/api";

export type BulkMode = "revoke" | "reextract" | "approve" | "reject" | null;

type MetadataField = "type" | "issuer_organization" | "competency";
type EligibilityCredential = Pick<
  CredentialDTO,
  | "status"
  | "activated_at"
  | "extract_state"
  | "file_uri"
  | "unresolved_metadata"
  | "type"
  | "issuer_organization"
  | "competencies"
>;

export type IneligibilityReason =
  | { kind: "status" }
  | { kind: "extract_state" }
  | { kind: "missing_file" }
  | { kind: "unresolved" | "inactive"; fields: MetadataField[] };

/** Client-side hints only; the backend rechecks fresh state and metadata on every action. */
export function ineligibilityReason(
  cred: EligibilityCredential,
  mode: BulkMode,
): IneligibilityReason | null {
  switch (mode) {
    case "revoke":
      return cred.activated_at && (cred.status === "approved" || cred.status === "expired")
        ? null
        : { kind: "status" };
    case "reextract":
      if (cred.extract_state !== "failed") return { kind: "extract_state" };
      return cred.file_uri ? null : { kind: "missing_file" };
    case "approve": {
      if (cred.status !== "pending") return { kind: "status" };
      const unresolved = (cred.unresolved_metadata ?? []).filter(
        (field): field is MetadataField =>
          field === "type" || field === "issuer_organization" || field === "competency",
      );
      if (unresolved.length) return { kind: "unresolved", fields: unresolved };
      const inactive: MetadataField[] = [];
      if (cred.type?.active === false) inactive.push("type");
      if (cred.issuer_organization?.active === false) inactive.push("issuer_organization");
      if (cred.competencies?.some((comp) => comp.active === false)) inactive.push("competency");
      return inactive.length ? { kind: "inactive", fields: inactive } : null;
    }
    case "reject":
      return cred.status === "pending" ? null : { kind: "status" };
    default:
      return { kind: "status" };
  }
}

export function isEligibleFor(cred: EligibilityCredential, mode: BulkMode): boolean {
  return mode !== null && ineligibilityReason(cred, mode) === null;
}
