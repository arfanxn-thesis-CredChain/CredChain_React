import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { TestProviders } from "@/test/TestProviders";
import { useUserUnits } from "./useUserUnits";

describe("useUserUnits", () => {
  it("fetches the whole tree when no search term is given", async () => {
    const { result } = renderHook(() => useUserUnits(), { wrapper: TestProviders });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((result.current.data ?? []).length).toBeGreaterThan(1);
  });

  it("returns a match together with its ancestor chain", async () => {
    // The backend CTE climbs to the root so the client can still build a tree;
    // the MSW handler mirrors it. A nested match must bring its parents along.
    const { result } = renderHook(() => useUserUnits("Computer Science"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const rows = result.current.data ?? [];
    const names = rows.map((r) => r.name);

    // Only the child matches the term, but its parent comes along.
    expect(names).toEqual(["Faculty of Engineering", "Computer Science Department"]);

    // No returned row points at an absent parent, so nothing renders as a false
    // root.
    const ids = new Set(rows.map((r) => r.id));
    for (const row of rows) {
      if (row.parent_id) expect(ids.has(row.parent_id)).toBe(true);
    }
  });

  it("returns a matched parent together with its subtree", async () => {
    // The mirror direction: matching a parent means asking what is in it, so
    // the CTE descends as well as climbs.
    const { result } = renderHook(() => useUserUnits("Faculty of Engineering"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const names = (result.current.data ?? []).map((r) => r.name);

    // Only the parent matches the term, but its child comes along.
    expect(names).toEqual(["Faculty of Engineering", "Computer Science Department"]);
  });

  it("excludes branches with no match", async () => {
    const { result } = renderHook(() => useUserUnits("zzz-no-such-unit"), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
