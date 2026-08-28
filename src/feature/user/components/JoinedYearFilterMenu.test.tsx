import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { JoinedYearFilterMenu } from "./JoinedYearFilterMenu";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

const trigger = () => screen.getByRole("button", { name: /joined year/i });

describe("JoinedYearFilterMenu", () => {
  it.each([
    [{ from: "", to: "" }, /joined year: all/i],
    [{ from: "2020", to: "2024" }, /joined year: 2020–2024/i],
    [{ from: "2020", to: "" }, /joined year: 2020 onwards/i],
    [{ from: "", to: "2024" }, /joined year: up to 2024/i],
  ])("labels the trigger for %o", (props, expected) => {
    render(<JoinedYearFilterMenu {...props} onChange={vi.fn()} />, { wrapper: TestProviders });
    expect(trigger()).toHaveAccessibleName(expected);
  });

  it("emits both bounds when only From is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JoinedYearFilterMenu from="" to="" onChange={onChange} />, { wrapper: TestProviders });

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitem", { name: "From 2020" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2020", to: "" });
  });

  it("keeps the panel open after a pick, so both bounds are one visit", async () => {
    const user = userEvent.setup();
    render(<JoinedYearFilterMenu from="" to="" onChange={vi.fn()} />, { wrapper: TestProviders });

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitem", { name: "From 2020" }));
    expect(screen.getByRole("menuitem", { name: "To 2024" })).toBeInTheDocument();
  });

  it("clears To when the new From would invert the range", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JoinedYearFilterMenu from="" to="2020" onChange={onChange} />, {
      wrapper: TestProviders,
    });

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitem", { name: "From 2024" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2024", to: "" });
  });

  it("clears From when the new To would invert the range", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JoinedYearFilterMenu from="2024" to="" onChange={onChange} />, {
      wrapper: TestProviders,
    });

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitem", { name: "To 2020" }));
    expect(onChange).toHaveBeenCalledWith({ from: "", to: "2020" });
  });

  it("resets both bounds", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JoinedYearFilterMenu from="2020" to="2024" onChange={onChange} />, {
      wrapper: TestProviders,
    });

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitem", { name: /reset/i }));
    expect(onChange).toHaveBeenCalledWith({ from: "", to: "" });
  });

  it("deselects a bound when its active year is picked again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JoinedYearFilterMenu from="2020" to="" onChange={onChange} />, {
      wrapper: TestProviders,
    });

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitem", { name: "From 2020" }));
    expect(onChange).toHaveBeenCalledWith({ from: "", to: "" });
  });
});
