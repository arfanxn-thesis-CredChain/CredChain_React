import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { CredentialFilterMenu } from "./CredentialFilterMenu";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

const OPTIONS = [
  { id: "opt_a", name: "Alpha" },
  { id: "opt_b", name: "Beta" },
];

function renderMenu(props: Partial<React.ComponentProps<typeof CredentialFilterMenu>> = {}) {
  return render(
    <CredentialFilterMenu
      labelKey="cred.filter.type"
      allLabelKey="cred.filter.typeAll"
      value={null}
      onChange={vi.fn()}
      options={OPTIONS}
      {...props}
    />,
    { wrapper: TestProviders },
  );
}

describe("CredentialFilterMenu", () => {
  it("shows the all label when no option is selected", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: /all/i })).toBeInTheDocument();
  });

  it("shows the selected option name in the trigger", () => {
    renderMenu({ value: "opt_a" });
    expect(screen.getByRole("button", { name: /alpha/i })).toBeInTheDocument();
  });

  it("calls onChange(null) when All is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMenu({ value: "opt_a", onChange });
    await user.click(screen.getByRole("button", { name: /alpha/i }));
    await user.click(await screen.findByRole("menuitem", { name: /all/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with the option id when an option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMenu({ onChange });
    await user.click(screen.getByRole("button", { name: /all/i }));
    await user.click(await screen.findByRole("menuitem", { name: /beta/i }));
    expect(onChange).toHaveBeenCalledWith("opt_b");
  });
});
