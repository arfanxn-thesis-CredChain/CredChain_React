import { describe, it, expect } from "vitest";
import { getVerdictTier, getMethodLabel, isExactHashMatch } from "./verdict";

describe("getVerdictTier", () => {
  it("returns green for authentic (400401)", () => {
    expect(getVerdictTier(400401)).toBe("green");
  });

  it("returns orange for revoked (400402)", () => {
    expect(getVerdictTier(400402)).toBe("orange");
  });

  it("returns red for tampered (400404)", () => {
    expect(getVerdictTier(400404)).toBe("red");
  });

  it("returns amber for suspicious (400405)", () => {
    expect(getVerdictTier(400405)).toBe("amber");
  });

  it("returns gray for low_similarity (400406)", () => {
    expect(getVerdictTier(400406)).toBe("gray");
  });

  it("returns light-gray for not_similar (400407)", () => {
    expect(getVerdictTier(400407)).toBe("light-gray");
  });

  it("returns light-gray for no_identifiers (400408)", () => {
    expect(getVerdictTier(400408)).toBe("light-gray");
  });

  it("returns light-gray for no_match (400409)", () => {
    expect(getVerdictTier(400409)).toBe("light-gray");
  });

  it("returns orange for integrity_warning (400403)", () => {
    expect(getVerdictTier(400403)).toBe("orange");
  });

  it("returns red for holder_disabled (400410)", () => {
    expect(getVerdictTier(400410)).toBe("red");
  });

  it("returns red for issuer_disabled (400411)", () => {
    expect(getVerdictTier(400411)).toBe("red");
  });

  it("returns red for party_disabled (400412)", () => {
    expect(getVerdictTier(400412)).toBe("red");
  });

  it("returns expired for expired (400413)", () => {
    expect(getVerdictTier(400413)).toBe("expired");
  });

  it("returns light-gray for unknown verdict code", () => {
    expect(getVerdictTier(999999)).toBe("light-gray");
  });
});

describe("getMethodLabel", () => {
  it("returns 'hash' when verdict_code is exact-hash (400401)", () => {
    expect(getMethodLabel(null, 400401)).toBe("hash");
  });

  it("returns 'hash' when verdict_code is exact-hash (400402)", () => {
    expect(getMethodLabel(null, 400402)).toBe("hash");
  });

  it("returns 'hash' when verdict_code is exact-hash (400413)", () => {
    expect(getMethodLabel(0.5, 400413)).toBe("hash");
  });

  it("returns 'fuzzy' when verdict_code is tampered (400404)", () => {
    expect(getMethodLabel(0.85, 400404)).toBe("fuzzy");
  });

  it("returns 'fuzzy' when verdict_code is no_identifiers (400408) even with null score", () => {
    expect(getMethodLabel(null, 400408)).toBe("fuzzy");
  });

  it("returns 'fuzzy' when verdict_code is no_match (400409) even with null score", () => {
    expect(getMethodLabel(null, 400409)).toBe("fuzzy");
  });

  it("returns 'hash' when similarity_score is null (no verdict_code)", () => {
    expect(getMethodLabel(null)).toBe("hash");
  });

  it("returns 'fuzzy' when similarity_score is defined (no verdict_code)", () => {
    expect(getMethodLabel(0.85)).toBe("fuzzy");
  });

  it("returns 'hash' when similarity_score is undefined (no verdict_code)", () => {
    expect(getMethodLabel(undefined)).toBe("hash");
  });
});

describe("isExactHashMatch", () => {
  it("returns true for authentic (400401)", () => {
    expect(isExactHashMatch(400401)).toBe(true);
  });

  it("returns true for revoked (400402)", () => {
    expect(isExactHashMatch(400402)).toBe(true);
  });

  it("returns true for integrity_warning (400403)", () => {
    expect(isExactHashMatch(400403)).toBe(true);
  });

  it("returns true for expired (400413)", () => {
    expect(isExactHashMatch(400413)).toBe(true);
  });

  it("returns false for tampered (400404)", () => {
    expect(isExactHashMatch(400404)).toBe(false);
  });

  it("returns false for suspicious (400405)", () => {
    expect(isExactHashMatch(400405)).toBe(false);
  });
});
