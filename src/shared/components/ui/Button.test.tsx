import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders primary variant with correct classes", () => {
    render(<Button variant="primary">Submit</Button>);
    const btn = screen.getByRole("button", { name: "Submit" });
    expect(btn.className).toContain("bg-navy");
    expect(btn.className).toContain("text-surface");
    expect(btn.className).toContain("focus-visible:ring-gold");
  });

  it("renders gold variant with correct classes", () => {
    render(<Button variant="gold">Premium</Button>);
    const btn = screen.getByRole("button", { name: "Premium" });
    expect(btn.className).toContain("bg-gold");
    expect(btn.className).toContain("text-navy");
  });

  it("renders destructive variant with correct classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn.className).toContain("bg-error");
    expect(btn.className).toContain("focus-visible:ring-error");
  });

  it("renders outline variant with correct classes", () => {
    render(<Button variant="outline">Cancel</Button>);
    const btn = screen.getByRole("button", { name: "Cancel" });
    expect(btn.className).toContain("border");
    expect(btn.className).toContain("focus-visible:ring-gold");
  });

  it("renders ghost variant with correct classes", () => {
    render(<Button variant="ghost">Action</Button>);
    const btn = screen.getByRole("button", { name: "Action" });
    expect(btn.className).toContain("focus-visible:ring-gold");
  });

  it("renders dashed variant with correct classes", () => {
    render(<Button variant="dashed">Add</Button>);
    const btn = screen.getByRole("button", { name: "Add" });
    expect(btn.className).toContain("border-dashed");
    expect(btn.className).toContain("focus-visible:ring-gold");
  });

  it("renders different sizes", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button", { name: "Small" }).className).toContain("px-3");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button", { name: "Large" }).className).toContain("px-6");
  });

  it("carries an explicit height per size", () => {
    // Heights are the contract Input pairs against. Padding-derived heights are
    // what forced items-stretch/h-full patches at every input+button row.
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button", { name: "Small" }).className).toContain("h-9");

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole("button", { name: "Medium" }).className).toContain("h-11");

    rerender(<Button>Default</Button>);
    expect(screen.getByRole("button", { name: "Default" }).className).toContain("h-11");
  });

  it("renders as child element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Link Button" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/test");
  });

  it("applies disabled state", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole("button", { name: "Disabled" });
    expect(btn).toBeDisabled();
    expect(btn.className).toContain("disabled:opacity-50");
  });

  it("defaults to type button", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button", { name: "Default" });
    expect(btn.getAttribute("type")).toBe("button");
  });
});
