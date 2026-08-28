import type { HolderUnitDTO } from "@shared/types/api";

export interface UnitNode {
  id: string;
  name: string;
  active: boolean;
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
    out.push({ id: u.id, name: u.name, active: u.active, depth });
    for (const c of childrenOf.get(u.id) ?? []) walk(c, depth + 1);
  };
  for (const r of roots) walk(r, 0);
  // Any unit not reached (pure cycle / disconnected): surface it at depth 0.
  for (const u of units) {
    if (!seen.has(u.id)) {
      seen.add(u.id);
      out.push({ id: u.id, name: u.name, active: u.active, depth: 0 });
    }
  }
  return out;
}

/** Separator between path segments in a unit reference, e.g. "Faculty > Dept". */
export const UNIT_PATH_SEPARATOR = ">";

export type UnitRef =
  | { ok: true; id: string }
  | { ok: false; reason: "unknown" }
  | { ok: false; reason: "inactive"; path: string }
  | { ok: false; reason: "ambiguous"; candidates: string[] };

/** Root-first ancestor chain for one unit, e.g. ["Faculty", "Dept"]. */
function pathSegments(unit: HolderUnitDTO, byId: Map<string, HolderUnitDTO>): string[] {
  const segments: string[] = [];
  const seen = new Set<string>();
  let current: HolderUnitDTO | undefined = unit;
  while (current && !seen.has(current.id)) {
    seen.add(current.id); // cycle guard, same as flattenUnitTree
    segments.unshift(current.name);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return segments;
}

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Resolve a spreadsheet cell to a unit id.
 *
 * Accepts an id, a bare name, or a `Faculty > Department` path. `user_units.name`
 * has no UNIQUE constraint, so a bare name can legitimately match several units;
 * that returns `ambiguous` with full paths rather than silently picking one.
 *
 * A factory because an import resolves up to 100 rows against up to 1000 units —
 * the lookup maps are built once, then each row is O(path depth).
 */
export function createUnitResolver(units: HolderUnitDTO[]): (raw: string) => UnitRef {
  const byId = new Map(units.map((u) => [u.id, u]));
  const idKeys = new Map(units.map((u) => [normalize(u.id), u.id]));
  const byName = new Map<string, HolderUnitDTO[]>();
  const byPath = new Map<string, HolderUnitDTO[]>();
  /** Display form, for error messages. */
  const pathOf = new Map<string, string>();

  for (const unit of units) {
    const segments = pathSegments(unit, byId);
    pathOf.set(unit.id, segments.join(` ${UNIT_PATH_SEPARATOR} `));

    const nameKey = normalize(unit.name);
    const nameGroup = byName.get(nameKey);
    if (nameGroup) nameGroup.push(unit);
    else byName.set(nameKey, [unit]);

    // Index every suffix, so "Faculty > Dept" resolves even under a deeper root.
    for (let i = 0; i < segments.length; i++) {
      const key = segments
        .slice(i)
        .map(normalize)
        .join(UNIT_PATH_SEPARATOR);
      const pathGroup = byPath.get(key);
      if (pathGroup) pathGroup.push(unit);
      else byPath.set(key, [unit]);
    }
  }

  const settle = (matches: HolderUnitDTO[]): UnitRef | undefined => {
    if (matches.length === 1) {
      const match = matches[0];
      if (!match.active) return { ok: false, reason: "inactive", path: pathOf.get(match.id) ?? match.name };
      return { ok: true, id: match.id };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        reason: "ambiguous",
        candidates: matches.map((u) => pathOf.get(u.id) ?? u.name),
      };
    }
    return undefined;
  };

  return (raw: string): UnitRef => {
    const key = normalize(raw);
    if (!key) return { ok: false, reason: "unknown" };

    const byIdHit = idKeys.get(key);
    if (byIdHit) return { ok: true, id: byIdHit };

    const nameHit = settle(byName.get(key) ?? []);
    if (nameHit) return nameHit;

    const pathKey = key
      .split(UNIT_PATH_SEPARATOR)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join(UNIT_PATH_SEPARATOR);
    const pathHit = settle(byPath.get(pathKey) ?? []);
    if (pathHit) return pathHit;

    return { ok: false, reason: "unknown" };
  };
}
