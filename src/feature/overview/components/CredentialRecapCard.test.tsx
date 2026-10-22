import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useLocation, useNavigate } from "react-router-dom";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
import { i18n } from "@shared/i18n/config";
import { CredentialRecapCard } from "./CredentialRecapCard";

function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.search}</output>
      <button onClick={() => navigate(-1)}>Go back</button>
    </>
  );
}
const renderCard = (url = "/overview") =>
  render(
    <>
      <CredentialRecapCard />
      <Location />
    </>,
    { wrapper: ({ children }) => <TestProviders initialEntries={[url]}>{children}</TestProviders> },
  );

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
describe("CredentialRecapCard", () => {
  it("names the distribution and keeps metric definitions accessible via dialog", async () => {
    const u = userEvent.setup();
    renderCard();
    expect(screen.getByRole("heading", { name: "Credential Distribution" })).toBeVisible();
    const trigger = screen.getByRole("button", { name: "About" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await u.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "About" })).toBeVisible();
    expect(within(dialog).getByText(/current unit and joined-year assignments/i)).toBeVisible();
    await u.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows additive totals and complete ownership columns", async () => {
    renderCard();
    expect(await screen.findByRole("columnheader", { name: /without credentials/i })).toBeVisible();
    const totals = screen.getByRole("row", { name: /filtered total/i });
    expect(within(totals).getAllByText("3").length).toBeGreaterThan(0);
    expect(within(totals).getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getByText(/current holders only/i)).toBeVisible();
  });
  it("filters by descendants in URL, preserves date, and restores history", async () => {
    const u = userEvent.setup();
    renderCard("/overview?date=..2026-01-01,2026-06-30&other=ok");
    await screen.findByRole("button", { name: /organisational unit:/i });
    await u.click(screen.getByRole("button", { name: /organisational unit:/i }));
    await u.click(screen.getByRole("menuitem", { name: /faculty of engineering/i }));
    expect(screen.getByTestId("location").textContent).toContain("recap_unit=unit_01");
    expect(screen.getByTestId("location").textContent).toContain("other=ok");
    expect(screen.getByTestId("location").textContent).toContain("date=");
    await u.click(screen.getByRole("button", { name: "Go back" }));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).not.toContain("recap_unit"),
    );
    expect(screen.getByRole("button", { name: /organisational unit: all/i })).toBeVisible();
  });
  it("supports regrouping, sorting and optional columns", async () => {
    const u = userEvent.setup();
    renderCard();
    await screen.findByRole("button", { name: /organisational unit:/i });
    await u.click(screen.getByRole("button", { name: /group: unit \+ year/i }));
    await u.click(screen.getByRole("menuitem", { name: "Organisational unit" }));
    expect(screen.queryByRole("columnheader", { name: "Joined year" })).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /columns/i }));
    await u.click(screen.getByRole("menuitemcheckbox", { name: "Revoked credentials" }));
    expect(screen.getByRole("columnheader", { name: "Revoked credentials" })).toBeVisible();
    await u.click(screen.getByRole("button", { name: "Holders" }));
    expect(screen.getByRole("columnheader", { name: "Holders" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });
  it("keeps filtered totals independent of visible rows", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      unit_id: "u",
      joined_year: 2020 + index,
      total_holders: 1,
      holders_with_credentials: 1,
      holders_without_credentials: 0,
      holders_with_active_credentials: 1,
      holders_without_active_credentials: 0,
      total_credentials: 2,
      active_credentials: 2,
      pending_credentials: 0,
      rejected_credentials: 0,
      expired_credentials: 0,
      revoked_credentials: 0,
    }));
    server.use(
      http.get("*/api/overview/credential-recap", () =>
        HttpResponse.json({
          code: 100100,
          data: {
            as_of: "2026-06-20T12:00:00Z",
            units: [{ id: "u", parent_id: null, name: "Unit", active: true }],
            rows,
          },
        }),
      ),
    );
    renderCard();
    const totals = await screen.findByRole("row", { name: /filtered total/i });
    expect(within(totals).getAllByText("12").length).toBeGreaterThan(0);
    expect(within(totals).getAllByText("24").length).toBe(2);
    expect(screen.getByText(/showing 10 of 12 groups/i)).toBeVisible();
  });

  it("resets visible rows when URL filter changes via browser back", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      unit_id: "u",
      joined_year: 2020 + index,
      total_holders: 1,
      holders_with_credentials: 1,
      holders_without_credentials: 0,
      holders_with_active_credentials: 1,
      holders_without_active_credentials: 0,
      total_credentials: 2,
      active_credentials: 2,
      pending_credentials: 0,
      rejected_credentials: 0,
      expired_credentials: 0,
      revoked_credentials: 0,
    }));
    server.use(
      http.get("*/api/overview/credential-recap", () =>
        HttpResponse.json({
          code: 100100,
          data: {
            as_of: "2026-06-20T12:00:00Z",
            units: [{ id: "u", parent_id: null, name: "Unit", active: true }],
            rows,
          },
        }),
      ),
    );
    const u = userEvent.setup();
    renderCard("/overview");
    await screen.findByText(/showing 10 of 12/i);
    await u.click(screen.getByRole("button", { name: /load more/i }));
    expect(screen.getByText(/showing 12 of 12/i)).toBeVisible();
    await u.click(screen.getByRole("button", { name: /organisational unit:/i }));
    await u.click(screen.getByRole("menuitem", { name: /unit/i }));
    expect(screen.getByTestId("location").textContent).toContain("recap_unit=u");
    expect(screen.getByText(/showing 10 of 12/i)).toBeVisible();
    await u.click(screen.getByRole("button", { name: /go back/i }));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).not.toContain("recap_unit"),
    );
  });

  it("distinguishes no holders, no matches, fetch failure and retry", async () => {
    const u = userEvent.setup();
    server.use(
      http.get("*/api/overview/credential-recap", () =>
        HttpResponse.json({
          code: 100100,
          data: { as_of: "2026-06-20T12:00:00Z", units: [], rows: [] },
        }),
      ),
    );
    const first = renderCard();
    expect(await screen.findByText(/no current holders/i)).toBeVisible();
    first.unmount();
    server.use(
      http.get("*/api/overview/credential-recap", () =>
        HttpResponse.json({
          code: 100100,
          data: {
            as_of: "2026-06-20T12:00:00Z",
            units: [{ id: "u", parent_id: null, name: "Unit", active: true }],
            rows: [
              {
                unit_id: "u",
                joined_year: 2024,
                total_holders: 1,
                holders_with_credentials: 0,
                holders_without_credentials: 1,
                holders_with_active_credentials: 0,
                holders_without_active_credentials: 1,
                total_credentials: 0,
                active_credentials: 0,
                pending_credentials: 0,
                rejected_credentials: 0,
                expired_credentials: 0,
                revoked_credentials: 0,
              },
              {
                unit_id: null,
                joined_year: null,
                total_holders: 1,
                holders_with_credentials: 0,
                holders_without_credentials: 1,
                holders_with_active_credentials: 0,
                holders_without_active_credentials: 1,
                total_credentials: 0,
                active_credentials: 0,
                pending_credentials: 0,
                rejected_credentials: 0,
                expired_credentials: 0,
                revoked_credentials: 0,
              },
            ],
          },
        }),
      ),
    );
    const second = renderCard("/overview?recap_year=unknown");
    await screen.findByRole("button", { name: /joined year:/i });
    await u.click(screen.getByRole("button", { name: /joined year:/i }));
    await u.click(screen.getByRole("menuitem", { name: "2024" }));
    await u.click(screen.getByRole("button", { name: /organisational unit:/i }));
    await u.click(screen.getByRole("menuitem", { name: /unassigned unit/i }));
    expect(await screen.findByText(/no groups match/i)).toBeVisible();
    await u.click(screen.getByRole("button", { name: /clear recap filters/i }));
    expect(screen.getByTestId("location").textContent).toBe("");
    second.unmount();
    server.use(
      http.get("*/api/overview/credential-recap", () =>
        HttpResponse.json({ code: 100500, message: "Failed" }, { status: 500 }),
      ),
    );
    renderCard();
    expect(await screen.findByText(/could not load credential recap/i)).toBeVisible();
    await u.click(screen.getByRole("button", { name: /retry/i }));
  });
});
