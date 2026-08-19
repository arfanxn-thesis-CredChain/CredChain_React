import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { TestProviders } from "@/test/TestProviders";
import { useUserUnits } from "./useUserUnits";

describe("useUserUnits (feature/user)", () => {
  it("fetches user units from /user-units", async () => {
    const { result } = renderHook(() => useUserUnits(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.data?.map((u) => u.name)).toEqual([
        "Faculty of Engineering",
        "Computer Science Department",
      ]);
    });
  });
});
