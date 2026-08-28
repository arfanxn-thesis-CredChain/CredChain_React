import { useSearchParams } from "react-router-dom";
import { Role } from "@shared/auth/role";

export type RoleFilter = "all" | Role;

export interface UserListParams {
  search: string;
  sort: string;
  status: "all" | "deleted_at_" | "deleted_at!_";
  role: RoleFilter;
  unit_id: string;
  /** Inclusive joined-year bounds; "" means unbounded on that side. */
  yearFrom: string;
  yearTo: string;
}

const DEFAULTS: UserListParams = {
  search: "",
  sort: "-updated_at",
  status: "all",
  role: "all",
  unit_id: "",
  yearFrom: "",
  yearTo: "",
};

/** Lower bound of the year pickers. Older joiners exist but are not filterable. */
export const YEAR_FLOOR = 1990;

function parseStatus(raw: string | null): "all" | "deleted_at_" | "deleted_at!_" {
  if (raw === "deleted_at_" || raw === "deleted_at!_") return raw;
  return "all";
}

function parseRole(raw: string | null): RoleFilter {
  if (
    raw === Role.SUPER_ADMIN ||
    raw === Role.ADMIN ||
    raw === Role.ISSUER ||
    raw === Role.HOLDER
  ) {
    return raw;
  }
  return "all";
}

/**
 * The URL is untrusted input that ends up concatenated into the filter DSL, so
 * anything outside a plausible four-digit year is dropped rather than forwarded.
 */
function parseYear(raw: string | null): string {
  if (!raw || !/^\d{4}$/.test(raw)) return "";
  const year = Number(raw);
  return year >= YEAR_FLOOR && year <= new Date().getFullYear() ? raw : "";
}

/**
 * Parse the single `joined_year` param, whose value is a `from..to` range
 * (`..` is the backend's BETWEEN operator). Either side may be empty for a
 * one-sided bound; extras beyond the first two segments are ignored.
 */
function parseYearRange(raw: string | null): { yearFrom: string; yearTo: string } {
  if (!raw) return { yearFrom: "", yearTo: "" };
  const [fromRaw, toRaw] = raw.split("..");
  return { yearFrom: parseYear(fromRaw ?? null), yearTo: parseYear(toRaw ?? null) };
}

/** Inverse of parseYearRange; "" when both sides are empty, so the key deletes. */
function serializeYearRange(from: string, to: string): string {
  if (!from && !to) return "";
  return `${from}..${to}`;
}

export function useUserListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const { yearFrom, yearTo } = parseYearRange(searchParams.get("joined_year"));

  const params: UserListParams = {
    search: searchParams.get("search") ?? DEFAULTS.search,
    sort: searchParams.get("sort") ?? DEFAULTS.sort,
    status: parseStatus(searchParams.get("status")),
    role: parseRole(searchParams.get("role")),
    unit_id: searchParams.get("unit_id") ?? DEFAULTS.unit_id,
    yearFrom,
    yearTo,
  };

  function setParam<K extends keyof UserListParams>(key: K, value: UserListParams[K]) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const stringVal = String(value);
      const defaultVal = String(DEFAULTS[key]);
      if (stringVal === defaultVal) {
        next.delete(key);
      } else {
        next.set(key, stringVal);
      }
      return next;
    });
  }

  function setYearRange(from: string, to: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const value = serializeYearRange(from, to);
      if (!value) next.delete("joined_year");
      else next.set("joined_year", value);
      return next;
    });
  }

  return { params, setParam, setYearRange };
}
