import { describe, expect, it } from "vitest";
import type { HolderUnitDTO } from "@shared/types/api";
import { ROOT_DROP_ID, resolveMove } from "./resolveMove";

function unit(id: string, parent_id: string | null, name = id): HolderUnitDTO {
  return { id, parent_id, name, created_at: "2026-01-01T00:00:00Z", updated_at: null };
}

// root -> child -> grandchild ; sibling is a second root
const units: HolderUnitDTO[] = [
  unit("root", null),
  unit("child", "root"),
  unit("grandchild", "child"),
  unit("sibling", null),
];

describe("resolveMove", () => {
  it("reparents onto an unrelated node", () => {
    expect(resolveMove("child", "sibling", units)).toEqual({ parentId: "sibling" });
  });

  it("is a no-op when dropped on itself", () => {
    expect(resolveMove("child", "child", units)).toBeNull();
  });

  it("is a no-op when dropped on the current parent", () => {
    expect(resolveMove("child", "root", units)).toBeNull();
  });

  it("rejects dropping onto a descendant (would create a cycle)", () => {
    expect(resolveMove("root", "grandchild", units)).toBeNull();
    expect(resolveMove("child", "grandchild", units)).toBeNull();
  });

  it("is a no-op when overId is null", () => {
    expect(resolveMove("child", null, units)).toBeNull();
  });

  it("promotes a nested node to root via the root drop zone", () => {
    expect(resolveMove("grandchild", ROOT_DROP_ID, units)).toEqual({ parentId: null });
  });

  it("is a no-op when dropping an already-root node on the root zone", () => {
    expect(resolveMove("root", ROOT_DROP_ID, units)).toBeNull();
  });

  it("is a no-op when the active node is unknown", () => {
    expect(resolveMove("ghost", "root", units)).toBeNull();
  });
});
