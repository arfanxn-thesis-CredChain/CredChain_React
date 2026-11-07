import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CredentialSortMenu } from "./CredentialSortMenu";
import { TestProviders } from "@/test/TestProviders";

describe("CredentialSortMenu", () => {
  it("renders trigger with Newest by default", () => {
    render(
      <TestProviders>
        <CredentialSortMenu value="-lifecycle_at" onChange={vi.fn()} />
      </TestProviders>,
    );
    expect(screen.getByRole("button", { name: /terbaru|newest/i })).toBeInTheDocument();
  });

  it("renders trigger with Oldest when value is lifecycle_at", () => {
    render(
      <TestProviders>
        <CredentialSortMenu value="lifecycle_at" onChange={vi.fn()} />
      </TestProviders>,
    );
    expect(screen.getByRole("button", { name: /terlama|oldest/i })).toBeInTheDocument();
  });

  it("calls onChange with selected value when an option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TestProviders>
        <CredentialSortMenu value="-lifecycle_at" onChange={onChange} />
      </TestProviders>,
    );

    const trigger = screen.getByRole("button", { name: /terbaru|newest/i });
    await user.click(trigger);

    const oldestItem = screen.getByRole("menuitem", { name: /terlama|oldest/i });
    await user.click(oldestItem);

    expect(onChange).toHaveBeenCalledWith("lifecycle_at");
  });
});
