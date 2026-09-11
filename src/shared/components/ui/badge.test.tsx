import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders with default navy tone", () => {
    render(<Badge>Active</Badge>);
    const el = screen.getByText("Active");
    expect(el).toHaveClass("bg-navy/10");
    expect(el).toHaveClass("text-navy");
  });

  it("renders with gold tone", () => {
    render(<Badge tone="gold">Pending</Badge>);
    const el = screen.getByText("Pending");
    expect(el).toHaveClass("bg-gold/20");
    expect(el).toHaveClass("text-navy");
  });

  it("renders with error tone", () => {
    render(<Badge tone="error">Failed</Badge>);
    const el = screen.getByText("Failed");
    expect(el).toHaveClass("bg-error/10");
    expect(el).toHaveClass("text-error");
  });

  it("renders with green tone", () => {
    render(<Badge tone="green">Success</Badge>);
    const el = screen.getByText("Success");
    expect(el).toHaveClass("bg-green-100");
    expect(el).toHaveClass("text-green-700");
  });

  it("renders with gray tone", () => {
    render(<Badge tone="gray">Inactive</Badge>);
    const el = screen.getByText("Inactive");
    expect(el).toHaveClass("bg-gray-100");
    expect(el).toHaveClass("text-gray-600");
  });

  it("renders with an icon", () => {
    render(
      <Badge tone="navy" icon={Activity}>
        Pulse
      </Badge>,
    );
    const badge = screen.getByText("Pulse");
    const svg = badge.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
