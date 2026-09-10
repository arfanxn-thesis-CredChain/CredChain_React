import type { CredentialDTO } from "@shared/types/api";

export type BulkMode = "revoke" | "reextract" | "approve" | "reject" | null;

/**
 * The one place bulk-action eligibility is decided, so the list's selection
 * filtering and the card's checkbox/mute state can't drift apart on what
 * each mode is allowed to touch. Mirrors the backend guards: revoke requires
 * `status === "approved"` (400344), re-extract requires a failed extraction
 * (400541), approve/reject require `status === "pending"`.
 */
export function isEligibleFor(
  cred: Pick<CredentialDTO, "status" | "extract_state">,
  mode: BulkMode,
): boolean {
  switch (mode) {
    case "revoke":
      return cred.status === "approved";
    case "reextract":
      return cred.extract_state === "failed";
    case "approve":
    case "reject":
      return cred.status === "pending";
    default:
      return false;
  }
}
