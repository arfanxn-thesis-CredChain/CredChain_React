import type { CredentialDTO } from "@shared/types/api";

export interface LifecycleDateLine {
  labelKey: string;
  timestamp: string | null;
  tone?: "error";
}

/**
 * The one lifecycle date line to show beneath "Tanggal terbit" (issued_at),
 * so card and detail can't drift apart on which date means what. issued_at
 * is the date printed on the certificate itself (holder-entered); this is
 * the system event date instead — when it was submitted, approved, rejected,
 * or (for revoked) both approved and revoked.
 */
export function lifecycleDateLines(c: Pick<CredentialDTO, "status" | "created_at" | "approved_at" | "rejected_at" | "revoked_at" | "submitter_user_id" | "holder_user_id">): LifecycleDateLine[] {
  const isSubmission = Boolean(c.submitter_user_id && c.submitter_user_id === c.holder_user_id);
  const approvedLabel = isSubmission ? "cred.lifecycle.approved" : "cred.card.registered";

  switch (c.status) {
    case "pending":
      return [{ labelKey: "cred.card.submitted", timestamp: c.created_at }];
    case "approved":
      return [{ labelKey: approvedLabel, timestamp: c.approved_at }];
    case "rejected":
      return [{ labelKey: "cred.lifecycle.rejected", timestamp: c.rejected_at }];
    case "revoked":
      return [
        { labelKey: approvedLabel, timestamp: c.approved_at },
        { labelKey: "cred.card.revoked", timestamp: c.revoked_at, tone: "error" },
      ];
  }
}

/**
 * The one date to show on a card when lifecycle status doesn't carry its own
 * event date (pending/approved) — role-appropriate: the holder sees when the
 * credential was issued, everyone else sees when it was submitted for review.
 * Exception: while pending, both roles see the submission date — showing
 * "Issued" on a card still badged "Pending review" reads as already-published,
 * which contradicts the status right next to it.
 */
export function primaryDateLine(
  c: Pick<CredentialDTO, "status" | "created_at" | "issued_at">,
  isHolder: boolean,
): LifecycleDateLine {
  if (c.status === "pending") {
    return { labelKey: "cred.card.submitted", timestamp: c.created_at };
  }
  return isHolder
    ? { labelKey: "cred.detail.issuedDate", timestamp: c.issued_at }
    : { labelKey: "cred.card.submitted", timestamp: c.created_at };
}
