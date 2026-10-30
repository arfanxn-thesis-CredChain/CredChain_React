import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "./form-field";

describe("FormField", () => {
  it("renders label and children", () => {
    render(
      <FormField label="Name">
        <input data-testid="name-input" />
      </FormField>,
    );
    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByTestId("name-input")).toBeDefined();
  });

  it("associates its label and error with an input", () => {
    render(
      <FormField label="Reason" htmlFor="reason" errorId="reason-error" error="Required">
        <input id="reason" aria-describedby="reason-error" />
      </FormField>,
    );
    expect(screen.getByRole("textbox")).toHaveAccessibleName("Reason");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "reason-error");
  });

  it("renders error message when error prop provided", () => {
    render(
      <FormField label="Name" error="Required field">
        <input />
      </FormField>,
    );
    const error = screen.getByRole("alert");
    expect(error).toBeDefined();
    expect(error.textContent).toContain("Required field");
  });

  it("renders hint text when no error and hint provided", () => {
    render(
      <FormField label="Name" hint="Enter your full name">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Enter your full name")).toBeDefined();
  });

  it("does not render hint when error is also present", () => {
    render(
      <FormField label="Name" error="Required" hint="Enter name">
        <input />
      </FormField>,
    );
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByText("Enter name")).toBeNull();
  });

  it("renders optional tag when optional is true", () => {
    render(
      <FormField label="Name" optional>
        <input />
      </FormField>,
    );
    expect(screen.getByText(/optional/i)).toBeDefined();
  });

  it("does not render optional tag by default", () => {
    render(
      <FormField label="Name">
        <input />
      </FormField>,
    );
    expect(screen.queryByText(/optional/i)).toBeNull();
  });

  it("does not render error or hint when neither provided", () => {
    render(
      <FormField label="Name">
        <input />
      </FormField>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
