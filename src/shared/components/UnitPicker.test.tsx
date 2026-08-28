import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
import { UnitPicker } from "./UnitPicker";

const inactiveUnits = () => [
  {
    id: "unit_01",
    parent_id: null,
    name: "Faculty of Engineering",
    active: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
  },
  {
    id: "unit_02",
    parent_id: "unit_01",
    name: "Computer Science Department",
    active: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
  },
];

beforeEach(() => {
  void i18n.changeLanguage("en");
});

describe("UnitPicker", () => {
  it("disables inactive options but keeps the selected inactive one clickable", async () => {
    server.use(
      http.get("*/api/user-units", () =>
        HttpResponse.json({ code: 301000, message: "ok", data: inactiveUnits() }),
      ),
    );

    const user = userEvent.setup();
    render(<UnitPicker label="Unit" value="unit_01" onChange={vi.fn()} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByRole("button", { name: "Unit" }));

    // Already selected + inactive: stays clickable so an existing assignment can
    // still be seen and changed.
    expect(
      await screen.findByRole("menuitem", { name: /Faculty of Engineering/ }),
    ).not.toHaveAttribute("aria-disabled", "true");
    // Unselected + inactive: unpickable (Radix conveys it via aria-disabled, not
    // a native disabled attribute, so assert the attribute directly).
    expect(
      screen.getByRole("menuitem", { name: /Computer Science Department/ }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Inactive")).toHaveLength(2);
  });
});
