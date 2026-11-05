import { describe, expect, it } from "vitest";
import { lifecycleDateLines } from "./credentialDate";
import { makeCredential } from "@/test/fixtures";

describe("lifecycleDateLines", () => {
  it("uses explicit public submission evidence without private user IDs", () => {
    const credential = makeCredential({ status: "revoked" });
    expect(lifecycleDateLines({ ...credential, is_submission: true })[0].labelKey).toBe(
      "cred.lifecycle.approved",
    );
    expect(lifecycleDateLines({ ...credential, is_submission: false })[0].labelKey).toBe(
      "cred.card.registered",
    );
    expect(lifecycleDateLines(credential)[1].labelKey).toBe("cred.card.revoked");
  });
});
