import type { HolderUnitDTO } from "@shared/types/api";

export interface UnitNode {
  id: string;
  name: string;
  /** 0 = root; each sub-unit level adds 1. Used to indent tree rows. */
  depth: number;
}

/**
 * Flatten a flat list of units (each carrying `parent_id`) into a depth-ordered
 * list for rendering as a tree. Siblings are sorted by name.
 *
 * Robustness:
 * - Units whose parent is not in the loaded set (pagination orphans) become roots.
 * - Every unit appears exactly once; disconnected nodes / cycles are appended at
 *   depth 0 rather than dropped or infinite-looped.
 */
export function flattenUnitTree(units: HolderUnitDTO[]): UnitNode[] {
  const ids = new Set(units.map((u) => u.id));
  const childrenOf = new Map<string, HolderUnitDTO[]>();
  for (const u of units) {
    if (u.parent_id && ids.has(u.parent_id)) {
      const arr = childrenOf.get(u.parent_id);
      if (arr) arr.push(u);
      else childrenOf.set(u.parent_id, [u]);
    }
  }
  const byName = (a: HolderUnitDTO, b: HolderUnitDTO) => a.name.localeCompare(b.name);
  for (const arr of childrenOf.values()) arr.sort(byName);

  const roots = units.filter((u) => !u.parent_id || !ids.has(u.parent_id)).sort(byName);
  const out: UnitNode[] = [];
  const seen = new Set<string>();
  const walk = (u: HolderUnitDTO, depth: number) => {
    if (seen.has(u.id)) return; // cycle guard
    seen.add(u.id);
    out.push({ id: u.id, name: u.name, depth });
    for (const c of childrenOf.get(u.id) ?? []) walk(c, depth + 1);
  };
  for (const r of roots) walk(r, 0);
  // Any unit not reached (pure cycle / disconnected): surface it at depth 0.
  for (const u of units) {
    if (!seen.has(u.id)) {
      seen.add(u.id);
      out.push({ id: u.id, name: u.name, depth: 0 });
    }
  }
  return out;
}
