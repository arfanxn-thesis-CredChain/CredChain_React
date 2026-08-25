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

  it("offers a search box even for a short list and filters client-side", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /all/i }));

    await user.type(await screen.findByRole("textbox", { name: /search/i }), "alp");
    expect(screen.getByRole("menuitem", { name: /alpha/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /beta/i })).not.toBeInTheDocument();
  });

  it("leaves server-side results alone", async () => {
    const user = userEvent.setup();
    // onSearchChange present => the page is already filtered upstream. Typing a
    // term that matches nothing locally must not hide the rows the server sent.
    renderMenu({ searchValue: "zzz", onSearchChange: vi.fn() });
    await user.click(screen.getByRole("button", { name: /all/i }));

    expect(await screen.findByRole("menuitem", { name: /alpha/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /beta/i })).toBeInTheDocument();
  });

  it("falls back to selectedName when the selection is past the loaded page", () => {
    renderMenu({ value: "opt_zz", selectedName: "Zeta" });
    expect(screen.getByRole("button", { name: /zeta/i })).toBeInTheDocument();
  });

  it("omits Load More when the list is complete", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /all/i }));
    await screen.findByRole("menuitem", { name: /alpha/i });
    expect(screen.queryByRole("menuitem", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("keeps the menu open when Load More is clicked", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    renderMenu({ hasMore: true, onLoadMore });
    await user.click(screen.getByRole("button", { name: /all/i }));
    await user.click(await screen.findByRole("menuitem", { name: /load more/i }));

    expect(onLoadMore).toHaveBeenCalled();
    // Radix closes on select; the preventDefault is what keeps the list up.
    expect(screen.getByRole("menuitem", { name: /alpha/i })).toBeInTheDocument();
  });
});
