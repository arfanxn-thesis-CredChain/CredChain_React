import type { CredentialRecap, CredentialRecapCounts, CredentialRecapRow } from "@shared/types/api";
import { pathSegments } from "@shared/lib/units";

export type RecapGrouping = "unit-year" | "unit" | "year";
export type RecapSort = keyof CredentialRecapCounts | "unit_id" | "joined_year";
export type RecapDirection = "asc" | "desc";
export const recapMetrics: (keyof CredentialRecapCounts)[] = [
  "total_holders",
  "holders_with_credentials",
  "holders_without_credentials",
  "holders_with_active_credentials",
  "holders_without_active_credentials",
  "total_credentials",
  "active_credentials",
  "pending_credentials",
  "rejected_credentials",
  "expired_credentials",
  "revoked_credentials",
];
export const defaultRecapColumns: RecapSort[] = [
  "unit_id",
  "joined_year",
  "total_holders",
  "holders_with_credentials",
  "holders_without_credentials",
  "total_credentials",
  "active_credentials",
];

export function sumRecap(rows: CredentialRecapRow[]): CredentialRecapCounts {
  const totals = Object.fromEntries(
    recapMetrics.map((key) => [key, 0]),
  ) as unknown as CredentialRecapCounts;
  for (const row of rows) for (const key of recapMetrics) totals[key] += row[key];
  return totals;
}

export function filterRecap(
  recap: CredentialRecap,
  unit: string | null,
  year: string | null,
): CredentialRecapRow[] {
  const descendants = new Set<string>();
  if (unit && unit !== "unassigned") {
    descendants.add(unit);
    for (let changed = true; changed; ) {
      changed = false;
      for (const item of recap.units)
        if (item.parent_id && descendants.has(item.parent_id) && !descendants.has(item.id)) {
          descendants.add(item.id);
          changed = true;
        }
    }
  }
  return recap.rows.filter(
    (row) =>
      (!unit ||
        (unit === "unassigned"
          ? row.unit_id === null
          : row.unit_id !== null && descendants.has(row.unit_id))) &&
      (!year || (year === "unknown" ? row.joined_year === null : row.joined_year === Number(year))),
  );
}

export function groupRecap(
  rows: CredentialRecapRow[],
  grouping: RecapGrouping,
): CredentialRecapRow[] {
  if (grouping === "unit-year") return rows;
  const grouped = new Map<string, CredentialRecapRow[]>();
  for (const row of rows) {
    const key = grouping === "unit" ? (row.unit_id ?? "") : String(row.joined_year ?? "");
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return Array.from(grouped.values(), (members) => ({
    ...sumRecap(members),
    unit_id: grouping === "year" ? null : members[0].unit_id,
    joined_year: grouping === "unit" ? null : members[0].joined_year,
  }));
}

export function sortRecap(
  rows: CredentialRecapRow[],
  units: CredentialRecap["units"],
  key: RecapSort = "unit_id",
  direction: RecapDirection = "asc",
): CredentialRecapRow[] {
  const byId = new Map(
    units.map((unit) => [unit.id, { ...unit, created_at: "", updated_at: null }]),
  );
  const path = (id: string | null) =>
    id
      ? pathSegments(
          byId.get(id) ?? {
            id,
            parent_id: null,
            name: id,
            active: false,
            created_at: "",
            updated_at: null,
          },
          byId,
        ).join(" > ")
      : null;
  const compare = (a: string | number | null, b: string | number | null, order: RecapDirection) => {
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    const difference =
      typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
    return order === "asc" ? difference : -difference;
  };
  return [...rows].sort(
    (a, b) =>
      compare(
        key === "unit_id" ? path(a.unit_id) : a[key],
        key === "unit_id" ? path(b.unit_id) : b[key],
        direction,
      ) ||
      compare(path(a.unit_id), path(b.unit_id), "asc") ||
      compare(a.joined_year, b.joined_year, "desc") ||
      String(a.unit_id).localeCompare(String(b.unit_id)),
  );
}

export function readRecapFilters(params: URLSearchParams, recap: CredentialRecap) {
  const rawUnit = params.get("recap_unit");
  const rawYear = params.get("recap_year");
  const years = new Set(recap.rows.map((row) => row.joined_year));
  return {
    unit:
      (rawUnit === "unassigned" && recap.rows.some((row) => row.unit_id === null)) ||
      recap.units.some((item) => item.id === rawUnit)
        ? rawUnit
        : null,
    year:
      (rawYear === "unknown" && years.has(null)) ||
      (rawYear !== null && /^\d{1,4}$/.test(rawYear) && years.has(Number(rawYear)))
        ? rawYear
        : null,
  };
}

export function setRecapFilter(
  params: URLSearchParams,
  key: "recap_unit" | "recap_year",
  value: string | null,
) {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  return next;
}
