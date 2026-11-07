export type CredentialSortKey = "-lifecycle_at" | "lifecycle_at" | "name" | "-name";

export interface CredentialSortOption {
  key: string;
  labelKey: string;
  value: CredentialSortKey;
}

export const CREDENTIAL_SORT_OPTIONS: readonly CredentialSortOption[] = [
  { key: "newest", labelKey: "cred.sort.newest", value: "-lifecycle_at" },
  { key: "oldest", labelKey: "cred.sort.oldest", value: "lifecycle_at" },
  { key: "nameAZ", labelKey: "cred.sort.nameAZ", value: "name" },
  { key: "nameZA", labelKey: "cred.sort.nameZA", value: "-name" },
] as const;

export const DEFAULT_CREDENTIAL_SORT: CredentialSortKey = "-lifecycle_at";

export function parseCredentialSort(paramValue: string | null): CredentialSortKey {
  if (!paramValue) return DEFAULT_CREDENTIAL_SORT;
  switch (paramValue) {
    case "-lifecycle_at":
    case "-issued_at":
    case "-revoked_at":
    case "-expires_at":
      return "-lifecycle_at";
    case "lifecycle_at":
    case "+lifecycle_at":
    case "issued_at":
    case "+issued_at":
    case "revoked_at":
    case "+revoked_at":
    case "expires_at":
    case "+expires_at":
      return "lifecycle_at";
    case "name":
    case "+name":
      return "name";
    case "-name":
      return "-name";
    default:
      return DEFAULT_CREDENTIAL_SORT;
  }
}

export function normalizeCredentialSortParam(
  searchParams: URLSearchParams,
  paramName: string = "sort",
): { normalizedSort: CredentialSortKey; updatedParams: URLSearchParams | null } {
  const rawValue = searchParams.get(paramName);
  const normalizedSort = parseCredentialSort(rawValue);

  const isDefault = normalizedSort === DEFAULT_CREDENTIAL_SORT;
  const isCanonical = isDefault ? rawValue === null : rawValue === normalizedSort;

  if (isCanonical) {
    return { normalizedSort, updatedParams: null };
  }

  const next = new URLSearchParams(searchParams);
  if (isDefault) {
    next.delete(paramName);
  } else {
    next.set(paramName, normalizedSort);
  }
  return { normalizedSort, updatedParams: next };
}
