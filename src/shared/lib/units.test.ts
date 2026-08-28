import { describe, expect, it } from "vitest";
import type { HolderUnitDTO } from "@shared/types/api";
import { createUnitResolver, flattenUnitTree } from "./units";

const u = (id: string, parent_id: string | null, name: string): HolderUnitDTO => ({
  id,
  parent_id,
  name,
  active: true,
  created_at: "",
  updated_at: null,
});

describe("flattenUnitTree", () => {
  it("orders parents before children with increasing depth", () => {
    const res = flattenUnitTree([u("b", "a", "Child"), u("a", null, "Root")]);
    expect(res.map((n) => [n.id, n.depth])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });

  it("sorts siblings by name", () => {
    const res = flattenUnitTree([u("z", null, "Zeta"), u("a", null, "Alpha")]);
    expect(res.map((n) => n.id)).toEqual(["a", "z"]);
  });

  it("treats units with a missing parent as roots (pagination orphans)", () => {
    const res = flattenUnitTree([u("x", "missing", "Orphan")]);
    expect(res).toEqual([{ id: "x", name: "Orphan", active: true, depth: 0 }]);
  });

  it("surfaces every unit exactly once even on a cycle", () => {
    const res = flattenUnitTree([u("a", "b", "A"), u("b", "a", "B")]);
    expect(res.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });
});

describe("createUnitResolver", () => {
  // Two faculties, each with a "Teknik Informatika" — names are not UNIQUE in
  // the schema, so this shape is legal and must resolve by path, not guess.
  const units = [
    u("01ROOT", null, "Fakultas Teknik"),
    u("01TI", "01ROOT", "Teknik Informatika"),
    u("01MIPA", null, "Fakultas MIPA"),
    u("01TI2", "01MIPA", "Teknik Informatika"),
    u("01SI", "01TI", "Sistem Informasi"),
  ];
  const resolve = createUnitResolver(units);

  it("matches an id exactly", () => {
    expect(resolve("01TI")).toEqual({ ok: true, id: "01TI" });
  });

  it("matches a name, trimmed and case-insensitive", () => {
    expect(resolve("  fakultas teknik  ")).toEqual({ ok: true, id: "01ROOT" });
  });

  it("reports a duplicated name as ambiguous with both full paths", () => {
    expect(resolve("Teknik Informatika")).toEqual({
      ok: false,
      reason: "ambiguous",
      candidates: ["Fakultas Teknik > Teknik Informatika", "Fakultas MIPA > Teknik Informatika"],
    });
  });

  it("disambiguates an ambiguous name via its path", () => {
    expect(resolve("Fakultas MIPA > Teknik Informatika")).toEqual({ ok: true, id: "01TI2" });
  });

  it("matches a path suffix, so the root may be omitted", () => {
    expect(resolve("teknik informatika>sistem informasi")).toEqual({ ok: true, id: "01SI" });
  });

  it("returns unknown for an unmatched or blank value", () => {
    expect(resolve("Fakultas Hukum")).toEqual({ ok: false, reason: "unknown" });
    expect(resolve("   ")).toEqual({ ok: false, reason: "unknown" });
  });

  it("reports an inactive unit as inactive rather than a match", () => {
    const resolveInactive = createUnitResolver([
      { ...u("01ROOT", null, "Fakultas Teknik"), active: false },
    ]);
    expect(resolveInactive("Fakultas Teknik")).toEqual({
      ok: false,
      reason: "inactive",
      path: "Fakultas Teknik",
    });
  });
});
