import type { CredentialVerifyDTO, VerificationPublicDetailsDTO } from "@shared/types/api";

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
  [VERDICT_CODE.TAMPERED]: "gray",
  [VERDICT_CODE.SUSPICIOUS]: "gray",
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
  VERDICT_CODE.HOLDER_DISABLED,
  VERDICT_CODE.ISSUER_DISABLED,
  VERDICT_CODE.PARTY_DISABLED,
]);

export function getVerdictTier(verdictCode: number): VerdictTier {
  return VERDICT_TIER_MAP[verdictCode] ?? "light-gray";
}

export function getMethodLabel(
  similarityScore: number | null | undefined,
  verdictCode?: number,
): "hash" | "fuzzy" | "identifiers" {
  if (verdictCode === VERDICT_CODE.NO_IDENTIFIERS || verdictCode === VERDICT_CODE.NO_MATCH)
    return "identifiers";
  if (verdictCode != null && EXACT_HASH_CODES.has(verdictCode)) return "hash";
  if (verdictCode != null && !EXACT_HASH_CODES.has(verdictCode)) return "fuzzy";
  return similarityScore != null ? "fuzzy" : "hash";
}

export function isExactHashMatch(verdictCode: number): boolean {
  return EXACT_HASH_CODES.has(verdictCode);
}

const PUBLIC_DETAIL_CODES = new Set([400401, 400402, 400410, 400411, 400412, 400413]);

export function getPublicVerificationDetails(
  result: CredentialVerifyDTO,
): VerificationPublicDetailsDTO | null {
  return result.exact_match_confirmed === true &&
    PUBLIC_DETAIL_CODES.has(result.verdict_code) &&
    !!result.credential &&
    !!result.public_details &&
    result.credential.id === result.public_details.id
    ? result.public_details
    : null;
}

const PRESENTATION_KEYS: Record<number, string> = {
  400401: "legacy",
  400402: "revoked",
  400403: "integrity",
  400404: "highSimilarity",
  400405: "similar",
  400406: "lowSimilarity",
  400407: "notSimilar",
  400408: "noIdentifiers",
  400409: "noMatch",
  400410: "holderDisabled",
  400411: "issuerDisabled",
  400412: "partyDisabled",
  400413: "expired",
};

export function getVerificationPresentation(result: CredentialVerifyDTO) {
  const exact = getPublicVerificationDetails(result) != null;
  const key =
    PUBLIC_DETAIL_CODES.has(result.verdict_code) && !exact
      ? "legacy"
      : result.verdict_code === 400401 && exact
        ? "exact"
        : (PRESENTATION_KEYS[result.verdict_code] ?? "unknown");
  const tone: "success" | "warning" | "neutral" =
    key === "exact"
      ? "success"
      : [
            "revoked",
            "expired",
            "integrity",
            "holderDisabled",
            "issuerDisabled",
            "partyDisabled",
          ].includes(key)
        ? "warning"
        : "neutral";
  return { key, tone, candidate: result.verdict_code >= 400404 && result.verdict_code <= 400407 };
}
