import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
import { useStore } from "@app/store";
import { makeUser } from "@/test/fixtures";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { Overview } from "./Overview";

function SearchDisplay() {
  const location = useLocation();
  return <div data-testid="search">{location.search}</div>;
}

function renderOverview(initialEntries?: string[]) {
  return render(<Overview />, {
    wrapper: ({ children }) => (
      <TestProviders initialEntries={initialEntries ?? ["/"]}>{children}</TestProviders>
    ),
  });
}

describe("Overview", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useStore.setState({ isAuthenticated: true, user: null });
  });

  it("renders PageHeader with user name", async () => {
    useStore.setState({
      user: makeUser({ name: "Arfan", role: Role.ISSUER }),
    });
    renderOverview();
    await waitFor(() => expect(screen.getByText("Welcome, Arfan")).toBeDefined());
  });

  it("renders credential counts section", async () => {
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    await waitFor(() => {
      expect(screen.getByText("Credentials")).toBeDefined();
    });
    expect(screen.getByText("450")).toBeDefined();
    expect(screen.getByText("500")).toBeDefined();
  });

  it("renders user counts for Issuer+", async () => {
    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
    renderOverview();
    await waitFor(() => {
      expect(screen.getAllByText("Users").length).toBe(2);
      expect(screen.getAllByText("Holders").length).toBe(2);
    });
  });

  it("hides user counts for Holder", async () => {
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    await waitFor(() => expect(screen.getByText("Credentials")).toBeDefined());
    expect(screen.queryByText("Users")).toBeNull();
  });

  it("renders chain details for Issuer+", async () => {
    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
    renderOverview();
    await waitFor(() => {
      expect(screen.getAllByText("Chain Info").length).toBe(2);
    });
  });

  it("renders relayer wallet and balance for Issuer+", async () => {
    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
    renderOverview();
    await waitFor(() => {
      expect(screen.getAllByText("Relayer Wallet").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Relayer Balance").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("10499.98").length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByTitle("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266").length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("hides chain details for Holder", async () => {
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    await waitFor(() => expect(screen.getByText("Credentials")).toBeDefined());
    expect(screen.queryByText("Chain Info")).toBeNull();
  });

  it("shows recent activity section", async () => {
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeDefined();
      expect(screen.getByText("Recently Issued")).toBeDefined();
    });
  });

  it("does not crash when the backend omits recent credential arrays", async () => {
    server.use(
      http.get("*/api/overview", () =>
        HttpResponse.json({
          code: 100100,
          data: {
            credential_counts: { total: 0, active: 0, revoked: 0, pending: 0, failed: 0 },
            recents: {},
          },
        }),
      ),
    );
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeDefined();
    });
    // Card-level empty state only; individual sections are hidden.
    expect(screen.getAllByText("No recent activity").length).toBe(1);
  });

  it("hides empty recent sections", async () => {
    server.use(
      http.get("*/api/overview", () =>
        HttpResponse.json({
          code: 100100,
          data: {
            credential_counts: { total: 1, active: 1, revoked: 0, pending: 0, failed: 0 },
            user_counts: {
              total: 0,
              holder: 0,
              issuer: 0,
              admin: 0,
              super_admin: 0,
              active: 0,
              trashed: 0,
            },
            recents: {
              active_credentials: [
                {
                  id: "01J1",
                  name: "Bachelor's Degree",
                  holder: { id: "01H1", name: "John", email: "john@example.com", role: "holder" },
                  issuer: { id: "01I1", name: "UI", email: "admin@ui.ac.id", role: "issuer" },
                  issued_at: "2026-06-20T10:00:00Z",
                },
              ],
              revoked_credentials: [],
              stored_users: [],
            },
          },
        }),
      ),
    );
    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
    renderOverview();
    await waitFor(() => {
      expect(screen.getAllByText("Recently Issued").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryAllByText("Recently Revoked").length).toBe(0);
    expect(screen.queryAllByText("New User").length).toBe(0);
    expect(screen.queryAllByText("No recent activity").length).toBe(0);
  });

  it("links revoked section to credential list with revoked filter", async () => {
    server.use(
      http.get("*/api/overview", () =>
        HttpResponse.json({
          code: 100100,
          data: {
            credential_counts: { total: 1, active: 0, revoked: 1, pending: 0, failed: 0 },
            recents: {
              active_credentials: [],
              revoked_credentials: [
                {
                  id: "01J2",
                  name: "Diploma",
                  holder: { id: "01H2", name: "Jane", email: "jane@example.com", role: "holder" },
                  revoker: { id: "01R1", name: "Admin", email: "admin@example.com", role: "admin" },
                  issued_at: "2026-04-01T00:00:00Z",
                  revoked_at: "2026-06-19T08:00:00Z",
                },
              ],
              stored_users: [],
            },
          },
        }),
      ),
    );
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    await waitFor(() => {
      expect(screen.getByText("Recently Revoked")).toBeDefined();
    });
    const link = screen.getByRole("link", { name: /view all credentials/i });
    expect(link).toHaveAttribute("href", "/credentials?review=revoked");
  });

  it("parses single date URL param into API filter", async () => {
    let capturedParams: URLSearchParams | null = null;
    server.use(
      http.get("*/api/overview", ({ request }) => {
        capturedParams = new URL(request.url).searchParams;
        return HttpResponse.json({
          code: 100100,
          data: {
            credential_counts: { total: 0, active: 0, revoked: 0, pending: 0, failed: 0 },
            recents: {},
          },
        });
      }),
    );
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview(["/overview?date=..2026-01-01,2026-06-30"]);
    await waitFor(() => expect(capturedParams).not.toBeNull());
    expect(capturedParams!.getAll("filters")).toEqual(["date..2026-01-01,2026-06-30"]);
  });

  it("writes single date URL param when date range changes", async () => {
    const u = userEvent.setup();
    const user = makeUser({ role: Role.HOLDER });
    useStore.setState({ user });
    render(
      <>
        <Overview />
        <SearchDisplay />
      </>,
      {
        wrapper: ({ children }) => (
          <TestProviders initialEntries={["/overview"]}>{children}</TestProviders>
        ),
      },
    );
    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeDefined();
    });

    const filterButton = screen.getByRole("button", { name: /date range/i });
    await u.click(filterButton);

    const last7Days = screen.getByText("Last 7 days");
    await u.click(last7Days);

    await waitFor(() => {
      const search = screen.getByTestId("search").textContent ?? "";
      const params = new URLSearchParams(search);
      expect(params.get("date")).toMatch(/^\.\.\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/);
    });
  });
});
