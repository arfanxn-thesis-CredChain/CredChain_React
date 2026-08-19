import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { i18n } from "@shared/i18n/config";
import { CredentialRejectReasonModal } from "./CredentialRejectReasonModal";

const items = [
  { id: "cred_1", name: "Bachelor's Degree" },
  { id: "cred_2", name: "Employment Certificate" },
];

describe("CredentialRejectReasonModal", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  function renderModal(overrides: Partial<Parameters<typeof CredentialRejectReasonModal>[0]> = {}) {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      items,
      onSubmit: vi.fn(),
      isSubmitting: false,
      ...overrides,
    };
    render(<CredentialRejectReasonModal {...props} />);
    return props;
  }

  it("renders one reason input per selected credential", () => {
    renderModal();

    expect(screen.getByText("Bachelor's Degree")).toBeInTheDocument();
    expect(screen.getByText("Employment Certificate")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("does not call onSubmit while reasons are missing and shows per-field errors", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal().onSubmit;

    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });

  it("submits the rejections array with the provided reasons", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal().onSubmit;
    const inputs = screen.getAllByRole("textbox");

    await user.type(inputs[0], "Duplicate submission");
    await user.type(inputs[1], "Unreadable file");

    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(onSubmit).toHaveBeenCalledWith([
      { id: "cred_1", reason: "Duplicate submission" },
      { id: "cred_2", reason: "Unreadable file" },
    ]);
  });

  it("applies the first row's reason to all rows via apply-to-all", async () => {
    const user = userEvent.setup();
    renderModal();
    const inputs = screen.getAllByRole("textbox");

    await user.type(inputs[0], "Duplicate submission");
    await user.click(screen.getByRole("button", { name: /apply same reason/i }));

    expect(inputs[1]).toHaveValue("Duplicate submission");
  });

  it("disables apply-to-all while the first reason is empty", () => {
    renderModal();

    expect(screen.getByRole("button", { name: /apply same reason/i })).toBeDisabled();
  });

  it("shows a per-field error when a reason exceeds 1000 characters", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal().onSubmit;
    const inputs = screen.getAllByRole("textbox");

    fireEvent.change(inputs[0], { target: { value: "a".repeat(1001) } });
    await user.type(inputs[1], "Unreadable file");

    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the actions while submitting", () => {
    renderModal({ isSubmitting: true });

    expect(screen.getByRole("button", { name: /rejecting/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("closes the dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = renderModal().onOpenChange;

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
