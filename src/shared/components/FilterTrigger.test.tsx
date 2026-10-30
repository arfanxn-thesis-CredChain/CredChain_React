import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilterTrigger } from "./FilterTrigger";

describe("FilterTrigger", () => {
  it("renders with rounded-xl and h-9 by default and does not have rounded-lg", () => {
    render(<FilterTrigger>Filter</FilterTrigger>);
    const trigger = screen.getByRole("button", { name: "Filter" });
    expect(trigger).toHaveClass("rounded-xl", "h-9");
    expect(trigger).not.toHaveClass("rounded-lg");
  });

  it("applies active gold styles when active is true while keeping rounded-xl", () => {
    render(<FilterTrigger active>Active Filter</FilterTrigger>);
    const trigger = screen.getByRole("button", { name: "Active Filter" });
    expect(trigger).toHaveClass("rounded-xl", "border-gold", "bg-gold/10", "text-navy");
    expect(trigger).not.toHaveClass("rounded-lg");
  });

  it("merges custom className cleanly", () => {
    render(<FilterTrigger className="custom-class">Custom</FilterTrigger>);
    const trigger = screen.getByRole("button", { name: "Custom" });
    expect(trigger).toHaveClass("rounded-xl", "custom-class");
  });
});
