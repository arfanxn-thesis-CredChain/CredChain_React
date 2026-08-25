import { describe, expect, it, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { InlineCreateRow } from "./InlineCreateRow";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

/** Mirrors a real caller: open state lives outside the component. */
function Harness({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <InlineCreateRow
      open={open}
      onOpenChange={setOpen}
      onSubmit={(name) => {
        onSubmit(name);
        setOpen(false); // what a successful mutation does
      }}
      triggerLabel="Add unit"
      placeholder="New unit name"
      submitLabel="Add"
    />
  );
}

describe("InlineCreateRow", () => {
  it("shows only the trigger until opened", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />, { wrapper: TestProviders });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add unit" }));
    expect(screen.getByRole("textbox", { name: "New unit name" })).toHaveFocus();
  });

  it("submits the trimmed name and refuses a blank one", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "Add unit" }));
    const submit = screen.getByRole("button", { name: "Add" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "  Informatics  ");
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledWith("Informatics");
  });

  it("clears the field when the caller closes the row after a save", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "Add unit" }));
    await user.type(screen.getByRole("textbox"), "Informatics");
    await user.click(screen.getByRole("button", { name: "Add" }));

    // Reopening must not resurrect the submitted name.
    await user.click(screen.getByRole("button", { name: "Add unit" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("cancel and Escape both collapse the row", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "Add unit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add unit" }));
    await user.type(screen.getByRole("textbox"), "x{Escape}");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders nothing when closed without a trigger label", () => {
    const { container } = render(
      <InlineCreateRow
        open={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="New unit name"
        submitLabel="Add"
      />,
      { wrapper: TestProviders },
    );
    expect(container).toBeEmptyDOMElement();
  });
});
