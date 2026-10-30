import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { ReferenceStatus } from "@shared/types/api";

export type ReferenceFilter = ReferenceStatus | "all" | "active" | "inactive";
const FILTERS: readonly string[] = ["active", "all", "approved", "inactive", "pending", "rejected"];

export function useReferenceStatusFilter(canFilterInactive: boolean) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("status");
  const filter: ReferenceFilter =
    raw && FILTERS.includes(raw) && (raw !== "inactive" || canFilterInactive)
      ? (raw as ReferenceFilter)
      : "active";

  useEffect(() => {
    if (raw !== null && filter === "active") {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete("status");
          return next;
        },
        { replace: true },
      );
    }
  }, [raw, filter, setParams]);

  const setFilter = (value: ReferenceFilter) => {
    if (value === filter || (value === "inactive" && !canFilterInactive)) return;
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value === "active") next.delete("status");
      else next.set("status", value);
      return next;
    });
  };
  return [filter, setFilter] as const;
}
