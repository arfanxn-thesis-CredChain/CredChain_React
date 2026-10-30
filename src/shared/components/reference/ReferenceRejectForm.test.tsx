import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestProviders } from "@/test/TestProviders";
import { ReferenceRejectForm } from "./ReferenceRejectForm";
import { i18n } from "@shared/i18n/config";

function mount(props: Partial<React.ComponentProps<typeof ReferenceRejectForm>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const result = render(
    <TestProviders>
      <ReferenceRejectForm onSubmit={onSubmit} onCancel={onCancel} {...props} />
    </TestProviders>,
  );
  return { ...result, onSubmit, onCancel };
}

describe("ReferenceRejectForm", () => {
  it.each([
    ["en", "A rejection reason is required.", "Reason must be 1000 characters or fewer."],
    ["id", "Alasan penolakan wajib diisi.", "Alasan maksimal 1000 karakter."],
  ])("localizes required and length errors in %s", async (language, required, tooLong) => {
    await i18n.changeLanguage(language);
    const { onSubmit } = mount();
    const reason = screen.getByRole("textbox");
    fireEvent.submit(reason.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(required);
    fireEvent.change(reason, { target: { value: "x".repeat(1001) } });
    fireEvent.submit(reason.closest("form")!);
    await screen.findByText(tooLong);
    expect(onSubmit).not.toHaveBeenCalled();
    await i18n.changeLanguage("en");
  });

  it("focuses compact labeled input, rejects whitespace and submits trimmed reason with Enter", async () => {
    const user = userEvent.setup();
    const { onSubmit } = mount();
    const reason = screen.getByRole("textbox");
    expect(reason.tagName).toBe("INPUT");
    expect(reason).toHaveClass("h-9");
    expect(reason).toHaveAccessibleName();
    expect(reason).toHaveFocus();
    await user.type(reason, "   ");
    fireEvent.submit(reason.closest("form")!);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.clear(reason);
    await user.type(reason, "  Duplicate entry  ");
    await user.keyboard("{Enter}");
    await screen.findByRole("textbox");
    expect(onSubmit).toHaveBeenCalledWith("Duplicate entry");
  });

  it("enforces the 1000-character limit even for programmatic input", async () => {
    const { onSubmit } = mount();
    const reason = screen.getByRole("textbox");
    fireEvent.change(reason, { target: { value: "x".repeat(1001) } });
    fireEvent.submit(reason.closest("form")!);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cancels with Escape without submitting", async () => {
    const user = userEvent.setup();
    const { onSubmit, onCancel } = mount();
    await user.type(screen.getByRole("textbox"), "Draft");
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables input and all actions while pending, including Escape and form submission", async () => {
    const { onSubmit, onCancel } = mount({ isPending: true });
    const reason = screen.getByRole("textbox");
    expect(reason).toBeDisabled();
    screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());
    fireEvent.keyDown(reason, { key: "Escape" });
    fireEvent.submit(reason.closest("form")!);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("announces server errors while preserving the draft", async () => {
    const user = userEvent.setup();
    const { rerender, onSubmit, onCancel } = mount();
    await user.type(screen.getByRole("textbox"), "Keep my reason");
    rerender(
      <TestProviders>
        <ReferenceRejectForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          error="cred.references.rejectError"
        />
      </TestProviders>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Keep my reason");
  });
});
