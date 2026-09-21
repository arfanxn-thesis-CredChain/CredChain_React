import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { CredentialStatusMenu } from "./CredentialStatusMenu";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

function renderMenu(props: Partial<React.ComponentProps<typeof CredentialStatusMenu>> = {}) {
  return render(
    <CredentialStatusMenu
      review="all"
      extract="any"
      onReviewChange={vi.fn()}
      onExtractChange={vi.fn()}
      {...props}
    />,
    { wrapper: TestProviders },
  );
}

describe("CredentialStatusMenu", () => {
  it("renders the Status label when both dimensions are at their defaults", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: /status/i })).toBeInTheDocument();
  });

  it("shows the pending count next to the Pending review option", async () => {
    const user = userEvent.setup();
    renderMenu({ pendingCount: 7 });
    await user.click(screen.getByRole("button", { name: /status/i }));
    expect(await screen.findByRole("menuitem", { name: /pending review 7/i })).toBeInTheDocument();
  });

  it("keeps the pending count visible while the pending filter is active", async () => {
    const user = userEvent.setup();
    renderMenu({ review: "pending", pendingCount: 7 });
    await user.click(screen.getByRole("button", { name: /pending review/i }));
    expect(await screen.findByRole("menuitem", { name: /pending review 7/i })).toBeInTheDocument();
  });

  it("renders both groups with their labels", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /status/i }));
    expect(await screen.findByText("Review status")).toBeInTheDocument();
    expect(screen.getByText("Extraction")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem", { name: /^all$/i })).toHaveLength(2);
  });

  it("selecting a review option calls onReviewChange only", async () => {
    const user = userEvent.setup();
    const onReviewChange = vi.fn();
    const onExtractChange = vi.fn();
    renderMenu({ onReviewChange, onExtractChange });
    await user.click(screen.getByRole("button", { name: /status/i }));
    await user.click(await screen.findByRole("menuitem", { name: /pending review/i }));
    expect(onReviewChange).toHaveBeenCalledWith("pending");
    expect(onExtractChange).not.toHaveBeenCalled();
  });

  it("selecting an extraction option keeps the review filter", async () => {
    const user = userEvent.setup();
    const onReviewChange = vi.fn();
    const onExtractChange = vi.fn();
    renderMenu({ review: "pending", onReviewChange, onExtractChange });
    await user.click(screen.getByRole("button", { name: /pending review/i }));
    await user.click(await screen.findByRole("menuitem", { name: /^failed$/i }));
    expect(onExtractChange).toHaveBeenCalledWith("failed");
    expect(onReviewChange).not.toHaveBeenCalled();
  });

  it("joins active labels with a middot when both dimensions are active", () => {
    renderMenu({ review: "pending", extract: "failed" });
    expect(screen.getByRole("button", { name: /pending review · failed/i })).toBeInTheDocument();
  });

  it("shows only the active label when a single dimension is active", () => {
    renderMenu({ review: "approved" });
    expect(screen.getByRole("button", { name: /^approved & registered$/i })).toBeInTheDocument();
  });
});
