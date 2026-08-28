import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useUserListParams } from "./useUserListParams";

function wrap(initialEntries: string[] = ["/users"]) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
}

describe("useUserListParams", () => {
  it("returns defaults when no query params", () => {
    const { result } = renderHook(() => useUserListParams(), { wrapper: wrap() });
    expect(result.current.params).toEqual({
      search: "",
      sort: "-updated_at",
      status: "all",
      role: "all",
      unit_id: "",
      yearFrom: "",
      yearTo: "",
    });
  });

  it("parses role from URL", () => {
    const { result } = renderHook(() => useUserListParams(), {
      wrapper: wrap(["/users?role=admin"]),
    });
    expect(result.current.params.role).toBe("admin");
  });

  it("invalid role defaults to all", () => {
    const { result } = renderHook(() => useUserListParams(), {
      wrapper: wrap(["/users?role=bogus"]),
    });
    expect(result.current.params.role).toBe("all");
  });

  it("setParam updates one key", () => {
    const { result } = renderHook(() => useUserListParams(), { wrapper: wrap() });
    act(() => result.current.setParam("search", "alice"));
    expect(result.current.params.search).toBe("alice");
  });

  it("parses unit_id from URL", () => {
    const { result } = renderHook(() => useUserListParams(), {
      wrapper: wrap(["/users?unit_id=unit_01"]),
    });
    expect(result.current.params.unit_id).toBe("unit_01");
  });

  it("defaults unit_id to empty string when absent", () => {
    const { result } = renderHook(() => useUserListParams(), { wrapper: wrap() });
    expect(result.current.params.unit_id).toBe("");
  });

  it("setParam sets unit_id and removes it when cleared to default", () => {
    const { result } = renderHook(() => useUserListParams(), { wrapper: wrap() });
    act(() => result.current.setParam("unit_id", "unit_02"));
    expect(result.current.params.unit_id).toBe("unit_02");
    act(() => result.current.setParam("unit_id", ""));
    expect(result.current.params.unit_id).toBe("");
  });

  it("parses a two-sided joined_year range from the URL", () => {
    const { result } = renderHook(() => useUserListParams(), {
      wrapper: wrap(["/users?joined_year=2020..2024"]),
    });
    expect(result.current.params.yearFrom).toBe("2020");
    expect(result.current.params.yearTo).toBe("2024");
  });

  it("parses one-sided joined_year bounds", () => {
    const fromOnly = renderHook(() => useUserListParams(), {
      wrapper: wrap(["/users?joined_year=2020.."]),
    });
    expect(fromOnly.result.current.params.yearFrom).toBe("2020");
    expect(fromOnly.result.current.params.yearTo).toBe("");

    const toOnly = renderHook(() => useUserListParams(), {
      wrapper: wrap(["/users?joined_year=..2024"]),
    });
    expect(toOnly.result.current.params.yearFrom).toBe("");
    expect(toOnly.result.current.params.yearTo).toBe("2024");
  });

  it("rejects years that are malformed, below the floor, or in the future", () => {
    const year = new Date().getFullYear();
    for (const raw of ["20xx", "202", "1989", String(year + 1)]) {
      const { result } = renderHook(() => useUserListParams(), {
        wrapper: wrap([`/users?joined_year=${raw}..2024`]),
      });
      expect(result.current.params.yearFrom).toBe("");
    }
  });

  it("setYearRange writes a two-sided range and clears it when empty", () => {
    const { result } = renderHook(() => useUserListParams(), { wrapper: wrap() });
    act(() => result.current.setYearRange("2020", "2024"));
    expect(result.current.params.yearFrom).toBe("2020");
    expect(result.current.params.yearTo).toBe("2024");
    act(() => result.current.setYearRange("", ""));
    expect(result.current.params.yearFrom).toBe("");
    expect(result.current.params.yearTo).toBe("");
  });

  it("setYearRange writes one-sided bounds", () => {
    const fromOnly = renderHook(() => useUserListParams(), { wrapper: wrap() });
    act(() => fromOnly.result.current.setYearRange("2020", ""));
    expect(fromOnly.result.current.params.yearFrom).toBe("2020");
    expect(fromOnly.result.current.params.yearTo).toBe("");

    const toOnly = renderHook(() => useUserListParams(), { wrapper: wrap() });
    act(() => toOnly.result.current.setYearRange("", "2024"));
    expect(toOnly.result.current.params.yearFrom).toBe("");
    expect(toOnly.result.current.params.yearTo).toBe("2024");
  });
});
