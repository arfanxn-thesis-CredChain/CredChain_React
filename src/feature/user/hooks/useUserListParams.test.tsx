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
      unit: "",
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

  it("setMany updates multiple", () => {
    const { result } = renderHook(() => useUserListParams(), { wrapper: wrap() });
    act(() => result.current.setMany({ sort: "name", status: "deleted_at_" }));
    expect(result.current.params.sort).toBe("name");
    expect(result.current.params.status).toBe("deleted_at_");
  });

  it("parses unit from URL", () => {
    const { result } = renderHook(() => useUserListParams(), {
      wrapper: wrap(["/users?unit=unit_01"]),
    });
    expect(result.current.params.unit).toBe("unit_01");
  });

  it("defaults unit to empty string when absent", () => {
    const { result } = renderHook(() => useUserListParams(), { wrapper: wrap() });
    expect(result.current.params.unit).toBe("");
  });

  it("setParam sets unit and removes it when cleared to default", () => {
    const { result } = renderHook(() => useUserListParams(), { wrapper: wrap() });
    act(() => result.current.setParam("unit", "unit_02"));
    expect(result.current.params.unit).toBe("unit_02");
    act(() => result.current.setParam("unit", ""));
    expect(result.current.params.unit).toBe("");
  });
});
