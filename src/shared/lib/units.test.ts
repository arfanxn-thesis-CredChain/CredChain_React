import { describe, expect, it } from "vitest";
import type { HolderUnitDTO } from "@shared/types/api";
import { flattenUnitTree } from "./units";

const u = (id: string, parent_id: string | null, name: string): HolderUnitDTO => ({
  id,
  parent_id,
  name,
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
    expect(res).toEqual([{ id: "x", name: "Orphan", depth: 0 }]);
  });

  it("surfaces every unit exactly once even on a cycle", () => {
    const res = flattenUnitTree([u("a", "b", "A"), u("b", "a", "B")]);
    expect(res.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });
});
