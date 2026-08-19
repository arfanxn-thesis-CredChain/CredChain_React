import { useSearchParams } from "react-router-dom";
import { Role } from "@shared/auth/role";

export type RoleFilter = "all" | Role;

export interface UserListParams {
  search: string;
  sort: string;
  status: "all" | "deleted_at_" | "deleted_at!_";
  role: RoleFilter;
  unit: string;
}

const DEFAULTS: UserListParams = {
  search: "",
  sort: "-updated_at",
  status: "all",
  role: "all",
  unit: "",
};

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

export function useUserListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params: UserListParams = {
    search: searchParams.get("search") ?? DEFAULTS.search,
    sort: searchParams.get("sort") ?? DEFAULTS.sort,
    status: parseStatus(searchParams.get("status")),
    role: parseRole(searchParams.get("role")),
    unit: searchParams.get("unit") ?? DEFAULTS.unit,
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

  function setMany(updates: Partial<UserListParams>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates) as [
        keyof UserListParams,
        UserListParams[keyof UserListParams],
      ][]) {
        const stringVal = String(value);
        const defaultVal = String(DEFAULTS[key]);
        if (stringVal === defaultVal) {
          next.delete(key);
        } else {
          next.set(key, stringVal);
        }
      }
      return next;
    });
  }

  return { params, setParam, setMany };
}
