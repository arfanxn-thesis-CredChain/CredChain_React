import { describe, expect, it } from "vitest";
import type { CredentialRecap } from "@shared/types/api";
import {
  filterRecap,
  groupRecap,
  sortRecap,
  sumRecap,
  readRecapFilters,
  setRecapFilter,
} from "./credential-recap";

const zero = {
  total_holders: 0,
  holders_with_credentials: 0,
  holders_without_credentials: 0,
  holders_with_active_credentials: 0,
  holders_without_active_credentials: 0,
  total_credentials: 0,
  active_credentials: 0,
  pending_credentials: 0,
  rejected_credentials: 0,
  expired_credentials: 0,
  revoked_credentials: 0,
};
const fixture: CredentialRecap = {
  as_of: "2026-06-01T00:00:00Z",
  units: [
    { id: "parent", parent_id: null, name: "Faculty", active: true },
    { id: "child", parent_id: "parent", name: "Department", active: false },
    { id: "other", parent_id: null, name: "Other", active: true },
  ],
  rows: [
    {
      ...zero,
      unit_id: "child",
      joined_year: 2024,
      total_holders: 1,
      holders_with_credentials: 1,
      holders_with_active_credentials: 1,
      total_credentials: 3,
      active_credentials: 2,
      expired_credentials: 1,
    },
    {
      ...zero,
      unit_id: "child",
      joined_year: 2025,
      total_holders: 1,
      holders_without_credentials: 1,
      holders_without_active_credentials: 1,
    },
    {
      ...zero,
      unit_id: null,
      joined_year: null,
      total_holders: 1,
      holders_with_credentials: 1,
      holders_without_active_credentials: 1,
      total_credentials: 4,
      pending_credentials: 1,
      rejected_credentials: 1,
      expired_credentials: 1,
      revoked_credentials: 1,
    },
  ],
};

describe("credential recap transformations", () => {
  it("includes descendants and unassigned while keeping holder counts additive", () => {
    const filtered = filterRecap(fixture, "parent", null);
    expect(sumRecap(filtered)).toMatchObject({
      total_holders: 2,
      holders_with_credentials: 1,
      total_credentials: 3,
      active_credentials: 2,
    });
    expect(sumRecap(groupRecap(filtered, "unit"))).toEqual(sumRecap(filtered));
    expect(filterRecap(fixture, "unassigned", "unknown")).toHaveLength(1);
    expect(sumRecap(fixture.rows)).toMatchObject({
      total_holders: 3,
      holders_with_credentials: 2,
      holders_without_credentials: 1,
      holders_with_active_credentials: 1,
      holders_without_active_credentials: 2,
      total_credentials: 7,
      active_credentials: 2,
    });
    expect(sumRecap([])).toEqual(zero);
  });

  it("groups by year and compares numerical values with deterministic null-last ties", () => {
    expect(groupRecap(fixture.rows, "year")).toHaveLength(3);
    const rows = [
      { ...zero, unit_id: "other", joined_year: 10, total_holders: 10 },
      { ...zero, unit_id: "child", joined_year: 2, total_holders: 2 },
      { ...zero, unit_id: null, joined_year: null, total_holders: 2 },
    ];
    expect(sortRecap(rows, fixture.units, "joined_year", "asc").map((r) => r.joined_year)).toEqual([
      2,
      10,
      null,
    ]);
    expect(sortRecap(rows, fixture.units, "total_holders", "asc").map((r) => r.unit_id)).toEqual([
      "child",
      null,
      "other",
    ]);
  });

  it("validates URL values and only changes the requested recap key", () => {
    const source = new URLSearchParams(
      "date=..2026-01-01,2026-06-01&other=keep&recap_unit=child&recap_year=2024",
    );
    expect(readRecapFilters(source, fixture)).toEqual({ unit: "child", year: "2024" });
    expect(
      readRecapFilters(new URLSearchParams("recap_unit=missing&recap_year=20x4"), fixture),
    ).toEqual({ unit: null, year: null });
    expect(
      readRecapFilters(new URLSearchParams("recap_unit=unassigned&recap_year=unknown"), fixture),
    ).toEqual({ unit: "unassigned", year: "unknown" });
    const changed = setRecapFilter(source, "recap_unit", null);
    expect(changed.get("recap_unit")).toBeNull();
    expect(changed.get("recap_year")).toBe("2024");
    expect(changed.get("date")).toBe("..2026-01-01,2026-06-01");
    expect(changed.get("other")).toBe("keep");
    expect(source.get("recap_unit")).toBe("child");
  });
});
