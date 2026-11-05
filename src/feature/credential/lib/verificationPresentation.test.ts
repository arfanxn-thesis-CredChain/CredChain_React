import { describe, expect, it } from "vitest";
import { getPublicVerificationDetails, getVerificationPresentation } from "./verdict";
import type { CredentialVerifyDTO } from "@shared/types/api";

const credential = {
  id: "record",
  name: "Diploma",
  status: "approved" as const,
  is_submission: true,
  issuer_organization_id: "org",
  issuer_organization_name: "Actual issuer",
  credential_type_name: "Diploma",
  number: null,
  file_hash: "0xabc",
  issued_at: "2026-01-01",
  expires_at: null,
};
const result = {
  verdict_code: 400401,
  description: "",
  similarity_score: null,
  similarity_percent: null,
  credential,
  exact_match_confirmed: true,
  public_details: {
    ...credential,
    issuer_organization_name: "Actual issuer",
    credential_type_name: "Diploma",
    revoked_at: null,
    holder: null,
    competencies: [],
    meta: null,
    token_id: "42",
    created_at: "2026-01-01",
    activated_at: "2026-01-02",
    rejected_at: null,
  },
};

describe("public verification evidence", () => {
  it.each([400401, 400402, 400410, 400411, 400412, 400413])(
    "permits confirmed exact outcome %s",
    (code) => {
      expect(getPublicVerificationDetails({ ...result, verdict_code: code })).toEqual(
        result.public_details,
      );
    },
  );
  it.each([400403, 400404, 400405, 400406, 400407, 400408, 400409, 999999])(
    "never permits outcome %s even at similarity100%",
    (code) => {
      expect(
        getPublicVerificationDetails({ ...result, verdict_code: code, similarity_score: 1 }),
      ).toBeNull();
    },
  );
  it("fails closed without evidence or matching record IDs", () => {
    expect(
      getPublicVerificationDetails({ ...result, exact_match_confirmed: undefined }),
    ).toBeNull();
    expect(
      getPublicVerificationDetails({
        ...result,
        public_details: { ...result.public_details, id: "other" },
      }),
    ).toBeNull();
    expect(getPublicVerificationDetails({ ...result, credential: null })).toBeNull();
  });
  it("does not infer live exact evidence from legacy success code", () => {
    expect(getVerificationPresentation({ ...result, exact_match_confirmed: false }).key).toBe(
      "legacy",
    );
    expect(getVerificationPresentation(result).key).toBe("exact");
  });
  it.each([
    400401, 400402, 400403, 400404, 400405, 400406, 400407, 400408, 400409, 400410, 400411, 400412,
    400413,
  ])("has explicit copy for %s", (code) => {
    expect(getVerificationPresentation({ ...result, verdict_code: code }).key).not.toBe("unknown");
  });
  it.each([400401, 400402, 400410, 400411, 400412, 400413])(
    "bounds cached authentic-like code %s without live evidence",
    (code) => {
      expect(
        getVerificationPresentation({
          ...result,
          verdict_code: code,
          exact_match_confirmed: false,
        }),
      ).toMatchObject({ key: "legacy", tone: "neutral" });
    },
  );
  it("unknown code stays neutral", () => {
    expect(
      getVerificationPresentation({ ...result, verdict_code: 999999 } as CredentialVerifyDTO),
    ).toMatchObject({ key: "unknown", tone: "neutral" });
  });
});
