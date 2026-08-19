import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { HolderUnitFilterMenu } from "./HolderUnitFilterMenu";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

describe("HolderUnitFilterMenu", () => {
  it("shows the all label when no unit is selected", async () => {
    render(<HolderUnitFilterMenu value="" onChange={vi.fn()} />, { wrapper: TestProviders });
    expect(
      await screen.findByRole("button", { name: /unit \(includes sub-units\): all/i }),
    ).toBeInTheDocument();
  });

  it("shows the selected unit name in the trigger", async () => {
    render(<HolderUnitFilterMenu value="unit_01" onChange={vi.fn()} />, { wrapper: TestProviders });
    expect(
      await screen.findByRole("button", {
        name: /unit \(includes sub-units\): faculty of engineering/i,
      }),
    ).toBeInTheDocument();
  });

  it("emits empty string when All is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HolderUnitFilterMenu value="unit_01" onChange={onChange} />, {
      wrapper: TestProviders,
    });

    const trigger = await screen.findByRole("button", {
      name: /unit \(includes sub-units\): faculty of engineering/i,
    });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: /^all$/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("emits the unit id when a unit is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HolderUnitFilterMenu value="" onChange={onChange} />, { wrapper: TestProviders });

    const trigger = await screen.findByRole("button", {
      name: /unit \(includes sub-units\): all/i,
    });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: /computer science department/i }));
    expect(onChange).toHaveBeenCalledWith("unit_02");
  });

  it("lists units loaded from the API", async () => {
    const user = userEvent.setup();
    render(<HolderUnitFilterMenu value="" onChange={vi.fn()} />, { wrapper: TestProviders });

    const trigger = await screen.findByRole("button", {
      name: /unit \(includes sub-units\): all/i,
    });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /faculty of engineering/i })).toBeInTheDocument();
    });
  });
});
