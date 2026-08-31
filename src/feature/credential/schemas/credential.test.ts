import { describe, it, expect } from "vitest";
import { credentialIssueRowSchema, credentialSubmitRowSchema, verifyFileSchema } from "./credential";

function makeFile(name: string, type: string, size = 1024): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

function makeIssueRow() {
  return {
    holder_user_id: "usr_1",
    type_id: "ctype_01",
    issuer_organization_id: "iorg_01",
    number: "",
    issued_at: "",
    expires_at: "",
    competency_ids: [],
    name: "Bachelor's Degree",
    meta_entries: [],
    file: makeFile("doc.pdf", "application/pdf"),
  };
}

describe("credentialIssueRowSchema", () => {
  it("accepts a fully valid row with only required fields", () => {
    const result = credentialIssueRowSchema.safeParse(makeIssueRow());
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields when present", () => {
    const result = credentialIssueRowSchema.safeParse({
      ...makeIssueRow(),
      number: "S-123",
      issued_at: "2024-01-15",
      expires_at: "2026-01-15",
      competency_ids: ["comp_01", "comp_02"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing type_id", () => {
    const result = credentialIssueRowSchema.safeParse({ ...makeIssueRow(), type_id: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.typeRequired");
    }
  });

  it("rejects a missing issuer_organization_id", () => {
    const result = credentialIssueRowSchema.safeParse({
      ...makeIssueRow(),
      issuer_organization_id: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.issuerOrganizationRequired");
    }
  });

  it("accepts a number of exactly 256 characters", () => {
    const result = credentialIssueRowSchema.safeParse({ ...makeIssueRow(), number: "x".repeat(256) });
    expect(result.success).toBe(true);
  });

  it("rejects a number longer than 256 characters", () => {
    const result = credentialIssueRowSchema.safeParse({ ...makeIssueRow(), number: "x".repeat(257) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.numberTooLong");
    }
  });

  it("rejects a malformed issued_at date", () => {
    const result = credentialIssueRowSchema.safeParse({
      ...makeIssueRow(),
      issued_at: "2024/01/15",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.dateFormat");
    }
  });

  it("rejects a malformed expires_at date", () => {
    const result = credentialIssueRowSchema.safeParse({
      ...makeIssueRow(),
      expires_at: "15-01-2024",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.dateFormat");
    }
  });

  it("rejects competency_ids containing an empty string", () => {
    const result = credentialIssueRowSchema.safeParse({ ...makeIssueRow(), competency_ids: [""] });
    expect(result.success).toBe(false);
  });

  it("rejects the new_holder sentinel value", () => {
    const result = credentialIssueRowSchema.safeParse({
      ...makeIssueRow(),
      holder_user_id: "new_holder",
    });
    expect(result.success).toBe(false);
  });

  it("still requires name and file", () => {
    expect(credentialIssueRowSchema.safeParse({ ...makeIssueRow(), name: "" }).success).toBe(false);
    expect(credentialIssueRowSchema.safeParse({ ...makeIssueRow(), file: null }).success).toBe(false);
  });
});

function makeSubmitRow() {
  return {
    name: "Bootcamp Certificate",
    type_id: "ctype_01",
    issuer_organization_id: "iorg_01",
    issued_at: "2026-01-15",
    file: makeFile("doc.pdf", "application/pdf"),
  };
}

describe("credentialSubmitRowSchema", () => {
  it("accepts a proposed type name with no id", () => {
    const result = credentialSubmitRowSchema.safeParse({
      ...makeSubmitRow(),
      type_id: undefined,
      issuer_organization_id: undefined,
      submitted_type_name: "Micro-credential",
      submitted_issuer_organization_name: "Cyfrin Updraft",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a row with neither type id nor type name", () => {
    const result = credentialSubmitRowSchema.safeParse({
      ...makeSubmitRow(),
      type_id: undefined,
      submitted_issuer_organization_name: "Cyfrin Updraft",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.submitTypeRequired");
    }
  });

  it("rejects a row carrying both a type id and a type name", () => {
    const result = credentialSubmitRowSchema.safeParse({
      ...makeSubmitRow(),
      submitted_type_name: "Micro-credential",
      submitted_issuer_organization_name: "Cyfrin Updraft",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.submitTypeRequired");
    }
  });

  it("rejects a row with neither organization id nor organization name", () => {
    const result = credentialSubmitRowSchema.safeParse({
      ...makeSubmitRow(),
      issuer_organization_id: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.submitOrganizationRequired");
    }
  });
});

describe("verifyFileSchema", () => {
  it("accepts a valid PDF file", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    const result = verifyFileSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it("accepts a valid JPEG file", () => {
    const file = makeFile("photo.jpg", "image/jpeg");
    const result = verifyFileSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it("accepts a valid PNG file", () => {
    const file = makeFile("image.png", "image/png");
    const result = verifyFileSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it("accepts a valid WebP file", () => {
    const file = makeFile("image.webp", "image/webp");
    const result = verifyFileSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it("accepts a valid TIFF file", () => {
    const file = makeFile("scan.tiff", "image/tiff");
    const result = verifyFileSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it("rejects file exceeding 10 MB", () => {
    const file = makeFile("large.pdf", "application/pdf", 11 * 1024 * 1024);
    const result = verifyFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.fileTooLarge");
    }
  });

  it("rejects unsupported MIME type", () => {
    const file = makeFile("script.exe", "application/x-executable");
    const result = verifyFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.fileTypeInvalid");
    }
  });

  it("rejects file with empty type", () => {
    const file = makeFile("unknown", "");
    const result = verifyFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("zod.credential.fileTypeInvalid");
    }
  });
});
