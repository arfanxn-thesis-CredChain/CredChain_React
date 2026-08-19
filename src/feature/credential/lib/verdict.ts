export type VerdictTier = "green" | "orange" | "red" | "amber" | "gray" | "light-gray" | "expired";

const VERDICT_CODE = {
  AUTHENTIC: 400401,
  REVOKED: 400402,
  INTEGRITY_WARNING: 400403,
  TAMPERED: 400404,
  SUSPICIOUS: 400405,
  LOW_SIMILARITY: 400406,
  NOT_SIMILAR: 400407,
  NO_IDENTIFIERS: 400408,
  NO_MATCH: 400409,
  HOLDER_DISABLED: 400410,
  ISSUER_DISABLED: 400411,
  PARTY_DISABLED: 400412,
  EXPIRED: 400413,
} as const;

const VERDICT_TIER_MAP: Record<number, VerdictTier> = {
  [VERDICT_CODE.AUTHENTIC]: "green",
  [VERDICT_CODE.REVOKED]: "orange",
  [VERDICT_CODE.INTEGRITY_WARNING]: "orange",
  [VERDICT_CODE.TAMPERED]: "red",
  [VERDICT_CODE.SUSPICIOUS]: "amber",
  [VERDICT_CODE.LOW_SIMILARITY]: "gray",
  [VERDICT_CODE.NOT_SIMILAR]: "light-gray",
  [VERDICT_CODE.NO_IDENTIFIERS]: "light-gray",
  [VERDICT_CODE.NO_MATCH]: "light-gray",
  [VERDICT_CODE.HOLDER_DISABLED]: "red",
  [VERDICT_CODE.ISSUER_DISABLED]: "red",
  [VERDICT_CODE.PARTY_DISABLED]: "red",
  [VERDICT_CODE.EXPIRED]: "expired",
};

const EXACT_HASH_CODES = new Set<number>([
  VERDICT_CODE.AUTHENTIC,
  VERDICT_CODE.REVOKED,
  VERDICT_CODE.INTEGRITY_WARNING,
  VERDICT_CODE.EXPIRED,
]);

export function getVerdictTier(verdictCode: number): VerdictTier {
  return VERDICT_TIER_MAP[verdictCode] ?? "light-gray";
}

export function getMethodLabel(
  similarityScore: number | null | undefined,
  verdictCode?: number,
): "hash" | "fuzzy" {
  if (verdictCode != null && EXACT_HASH_CODES.has(verdictCode)) return "hash";
  if (verdictCode != null && !EXACT_HASH_CODES.has(verdictCode)) return "fuzzy";
  return similarityScore != null ? "fuzzy" : "hash";
}

export function isExactHashMatch(verdictCode: number): boolean {
  return EXACT_HASH_CODES.has(verdictCode);
}
