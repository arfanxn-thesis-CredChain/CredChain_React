import type { HolderUnitDTO } from "@shared/types/api";

/**
 * Droppable id for the "make this a root unit" zone. Distinct from any real unit
 * id so a drop there is unambiguous.
 */
export const ROOT_DROP_ID = "__user-unit-root__";

export interface MoveResult {
  /** New parent id, or null to promote the node to a root unit. */
  parentId: string | null;
}

/** True when `nodeId` sits inside `ancestorId`'s subtree (walks parents upward). */
function isDescendantOf(units: HolderUnitDTO[], ancestorId: string, nodeId: string): boolean {
  const byId = new Map(units.map((u) => [u.id, u]));
  const seen = new Set<string>();
  let current = byId.get(nodeId);
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    if (seen.has(current.parent_id)) break; // guard against malformed cyclic data
    seen.add(current.parent_id);
    current = byId.get(current.parent_id);
  }
  return false;
}

/**
 * Resolve a drag-and-drop into the parent change to persist, or null when the
 * drop is a no-op or illegal. Pure so it can be unit-tested without the DOM.
 *
 * Rules: dropping onto self, onto the current parent, or onto one's own
 * descendant does nothing (the last would create a cycle — the backend also
 * rejects it with CodeUserUnitParentInvalid). Dropping on the root zone clears
 * the parent unless the node is already a root.
 */
export function resolveMove(
  activeId: string,
  overId: string | null,
  units: HolderUnitDTO[],
): MoveResult | null {
  if (!overId || overId === activeId) return null;

  const active = units.find((u) => u.id === activeId);
  if (!active) return null;

  if (overId === ROOT_DROP_ID) {
    return active.parent_id === null ? null : { parentId: null };
  }

  if (active.parent_id === overId) return null; // already this parent
  if (isDescendantOf(units, activeId, overId)) return null; // would create a cycle

  return { parentId: overId };
}
