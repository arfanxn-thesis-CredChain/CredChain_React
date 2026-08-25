import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";

describe("Input", () => {
  it("carries an explicit height matching the Button size scale", () => {
    // compact pairs with Button size="sm" (h-9), default with size="md" (h-11).
    const { rerender } = render(<Input size="compact" aria-label="Compact" />);
    expect(screen.getByLabelText("Compact").className).toContain("h-9");

    rerender(<Input aria-label="Default" />);
    const def = screen.getByLabelText("Default");
    expect(def.className).toContain("h-11");
    // A residual py- would shrink the content box inside the fixed height.
    expect(def.className).not.toContain("py-3");
  });

  it("lets the size token own the text scale", () => {
    const { rerender } = render(<Input size="compact" aria-label="Compact" />);
    expect(screen.getByLabelText("Compact").className).toContain("text-xs");

    rerender(<Input aria-label="Default" />);
    expect(screen.getByLabelText("Default").className).toContain("text-sm");
  });
});
