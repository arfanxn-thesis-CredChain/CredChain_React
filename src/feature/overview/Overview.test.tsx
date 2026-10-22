import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
import { useStore } from "@app/store";
import { makeUser } from "@/test/fixtures";
import { Role } from "@shared/auth/role";
import { formatDate } from "@shared/lib/format";
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
      expect(screen.getAllByText("Users").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Holders").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders active user and credential stats with gold accent styling", async () => {
    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
    renderOverview();

    await waitFor(() => {
      const userActiveLink = document.querySelector('a[href="/users?status=deleted_at_"]');
      const credActiveLink = document.querySelector('a[href="/credentials?review=approved"]');

      expect(userActiveLink).toBeInTheDocument();
      expect(userActiveLink).toHaveClass("bg-gold/10", "border-gold/20");

      expect(credActiveLink).toBeInTheDocument();
      expect(credActiveLink).toHaveClass("bg-gold/10", "border-gold/20");
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
      expect(screen.getAllByText("Chain Info").length).toBeGreaterThanOrEqual(1);
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
      expect(screen.getByText("Recently Registered")).toBeDefined();
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
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
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
      expect(screen.getAllByText("Recently Registered").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryAllByText("Recently Revoked").length).toBe(0);
    expect(screen.queryAllByText("New User").length).toBe(0);
    expect(screen.queryAllByText("No recent activity").length).toBe(0);
    const activity = screen.getByRole("heading", { name: "Recent Activity" }).parentElement!;
    expect(activity.querySelector(".grid")).toHaveClass("grid-cols-1");
    expect(activity.querySelector(".grid")).not.toHaveClass("sm:grid-cols-2", "lg:grid-cols-3");
    expect(within(activity).getAllByRole("article")).toHaveLength(1);
  });

  it("renders three compact tiles with separate detail, copy and category links", async () => {
    const u = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
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
    const activity = (await screen.findByRole("heading", { name: "Recent Activity" }))
      .parentElement!;
    const registered = within(activity).getByRole("article", { name: "Recently Registered" });
    const revoked = within(activity).getByRole("article", { name: "Recently Revoked" });
    const user = within(activity).getByRole("article", { name: "New User" });
    expect(activity.querySelector(".grid")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-3",
    );
    expect(within(activity).getAllByRole("article")).toHaveLength(3);
    expect(within(registered).getByRole("link", { name: "Bachelor's Degree" })).toHaveAttribute(
      "href",
      "/credentials?credential_id=01J1",
    );
    expect(within(revoked).getByRole("link", { name: "Diploma" })).toHaveAttribute(
      "href",
      "/credentials?credential_id=01J2",
    );
    expect(within(user).getByRole("link", { name: "Jane" })).toHaveAttribute("href", "/users/01H3");
    expect(within(registered).getByRole("link", { name: /view all credentials/i })).toHaveAttribute(
      "href",
      "/credentials",
    );
    expect(within(revoked).getByRole("link", { name: /view all credentials/i })).toHaveAttribute(
      "href",
      "/credentials?review=revoked",
    );
    expect(within(user).getByRole("link", { name: /view all users/i })).toHaveAttribute(
      "href",
      "/users",
    );

    // Profile richness: avatars and name links
    expect(within(registered).getAllByRole("presentation")).toHaveLength(2);
    expect(within(revoked).getAllByRole("presentation")).toHaveLength(2);
    expect(within(user).getByRole("presentation")).toBeInTheDocument();
    expect(within(registered).getByRole("link", { name: "John" })).toHaveAttribute(
      "href",
      "/users/01H1",
    );
    expect(within(registered).getByRole("link", { name: "UI" })).toHaveAttribute(
      "href",
      "/users/01I1",
    );
    expect(within(revoked).getByRole("link", { name: "Jane" })).toHaveAttribute(
      "href",
      "/users/01H2",
    );
    expect(within(revoked).getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/users/01R1",
    );
    expect(within(user).getByRole("link", { name: "Jane" })).toHaveAttribute("href", "/users/01H3");

    // Profile richness: metadata fields (unit, number, email, role, joined year)
    expect(await within(registered).findByText("Faculty of Engineering")).toBeVisible();
    expect(within(registered).getByText("22090009")).toBeVisible();
    expect(within(registered).getByText("john@example.com")).toBeVisible();
    expect(within(registered).getByText("Holder")).toBeVisible();
    expect(within(registered).getByText("Issuer")).toBeVisible();
    expect(within(registered).getByText(/joined 2023/i)).toBeVisible();

    expect(await within(revoked).findByText("Computer Science Department")).toBeVisible();
    expect(within(revoked).getByText("22090001")).toBeVisible();
    expect(within(revoked).getByText("jane@example.com")).toBeVisible();
    expect(within(revoked).getByText("Holder")).toBeVisible();
    expect(within(revoked).getAllByText("Admin")).toHaveLength(2);
    expect(within(revoked).getByText(/joined 2024/i)).toBeVisible();

    expect(within(user).getByText("jane@example.com")).toBeVisible();
    expect(within(user).getByText("Holder")).toBeVisible();
    expect(within(user).getByText(/joined 2024/i)).toBeVisible();
    expect(within(activity).queryByText(/created -/i)).not.toBeInTheDocument();
    expect(within(activity).queryByText(/joined -/i)).not.toBeInTheDocument();

    // Independent copy buttons
    const credCopy = within(registered).getByRole("button", { name: /copy credential id/i });
    expect(
      within(registered).getByRole("link", { name: "Bachelor's Degree" }).contains(credCopy),
    ).toBe(false);
    await u.click(credCopy);
    expect(writeTextMock).toHaveBeenCalledWith("01J1");
    expect(screen.getByTestId("search")).toHaveTextContent("");

    const holderNumberCopy = within(registered).getByRole("button", {
      name: /copy holder number/i,
    });
    await u.click(holderNumberCopy);
    expect(writeTextMock).toHaveBeenCalledWith("22090009");
    expect(screen.getByTestId("search")).toHaveTextContent("");

    const holderEmailCopy = within(registered).getByRole("button", { name: /copy holder email/i });
    await u.click(holderEmailCopy);
    expect(writeTextMock).toHaveBeenCalledWith("john@example.com");
    expect(screen.getByTestId("search")).toHaveTextContent("");

    const holderWalletCopy = within(registered).getByRole("button", {
      name: /copy holder wallet/i,
    });
    await u.click(holderWalletCopy);
    expect(writeTextMock).toHaveBeenCalledWith("0x" + "0".repeat(40));
    expect(screen.getByTestId("search")).toHaveTextContent("");

    const userEmailCopy = within(user).getByRole("button", { name: /copy user email/i });
    await u.click(userEmailCopy);
    expect(writeTextMock).toHaveBeenCalledWith("jane@example.com");
    expect(screen.getByTestId("search")).toHaveTextContent("");

    await u.click(within(registered).getByRole("link", { name: "Bachelor's Degree" }));
    expect(screen.getByTestId("search")).toHaveTextContent("credential_id=01J1");
  });

  it("uses two tiles without an empty third track for Holder", async () => {
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    const activity = (await screen.findByRole("heading", { name: "Recent Activity" }))
      .parentElement!;
    within(activity).getByRole("article", { name: "Recently Registered" });
    expect(within(activity).getAllByRole("article")).toHaveLength(2);
    expect(within(activity).queryByRole("article", { name: "New User" })).not.toBeInTheDocument();
    expect(activity.querySelector(".grid")).toHaveClass("sm:grid-cols-2", "lg:grid-cols-2");
    expect(activity.querySelector(".grid")).not.toHaveClass("lg:grid-cols-3");
  });

  it("hides redundant holder contact details in both credential activities for Holder", async () => {
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    const activity = (await screen.findByRole("heading", { name: "Recent Activity" }))
      .parentElement!;
    const registered = within(activity).getByRole("article", { name: "Recently Registered" });
    const revoked = within(activity).getByRole("article", { name: "Recently Revoked" });

    expect(within(registered).getByRole("link", { name: "Bachelor's Degree" })).toHaveAttribute(
      "href",
      "/credentials?credential_id=01J1",
    );
    expect(within(revoked).getByRole("link", { name: "Diploma" })).toHaveAttribute(
      "href",
      "/credentials?credential_id=01J2",
    );
    expect(within(registered).getByRole("link", { name: "UI" })).toBeVisible();
    expect(within(revoked).getByRole("link", { name: "Admin" })).toBeVisible();
    expect(within(registered).getByRole("link", { name: /view all credentials/i })).toHaveAttribute(
      "href",
      "/credentials",
    );
    expect(within(revoked).getByRole("link", { name: /view all credentials/i })).toHaveAttribute(
      "href",
      "/credentials?review=revoked",
    );
    for (const tile of [registered, revoked]) {
      expect(within(tile).queryByText(/^(John|Jane)$/)).not.toBeInTheDocument();
      expect(within(tile).queryByText(/^(john|jane)@example\.com$/)).not.toBeInTheDocument();
      expect(within(tile).queryByRole("button", { name: /copy holder/i })).not.toBeInTheDocument();
    }
  });

  it("omits missing people rather than inventing summary fields", async () => {
    server.use(
      http.get("*/api/overview", () =>
        HttpResponse.json({
          code: 100100,
          data: {
            credential_counts: { total: 1, active: 1, revoked: 0, pending: 0, failed: 0 },
            recents: {
              active_credentials: [
                { id: "01J4", name: "Certificate", issued_at: "2026-06-20T10:00:00Z" },
              ],
            },
          },
        }),
      ),
    );
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    const tile = await screen.findByRole("article", { name: "Recently Registered" });
    expect(within(tile).getByRole("link", { name: "Certificate" })).toHaveAttribute(
      "href",
      "/credentials?credential_id=01J4",
    );
    expect(within(tile).queryByText(/holder|registered by|created -/i)).not.toBeInTheDocument();
    expect(within(tile).queryByText(/@example\.com/i)).not.toBeInTheDocument();
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

  it("preserves recap selections and unrelated parameters when activity date changes", async () => {
    const u = userEvent.setup();
    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
    render(
      <>
        <Overview />
        <SearchDisplay />
      </>,
      {
        wrapper: ({ children }) => (
          <TestProviders initialEntries={["/overview?recap_unit=unit_02&recap_year=2024&other=ok"]}>
            {children}
          </TestProviders>
        ),
      },
    );
    await screen.findByRole("columnheader", { name: "Without credentials" });
    await u.click(screen.getByRole("button", { name: /date range/i }));
    await u.click(screen.getByText("Last 7 days"));
    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId("search").textContent ?? "");
      expect(params.get("date")).toMatch(/^\.\.\d{4}-\d{2}-\d{2},/);
      expect(params.get("recap_unit")).toBe("unit_02");
      expect(params.get("recap_year")).toBe("2024");
      expect(params.get("other")).toBe("ok");
    });
  });

  it("does not request recap for holders", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/overview/credential-recap", () => {
        calls++;
        return HttpResponse.json({
          code: 100100,
          data: { as_of: "2026-06-20T00:00:00Z", rows: [], units: [] },
        });
      }),
    );
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    await screen.findByText("Recent Activity");
    expect(screen.queryByText("Credential recapitulation")).toBeNull();
    expect(calls).toBe(0);
  });

  it.each([Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN])("shows recap to %s", async (role) => {
    useStore.setState({ user: makeUser({ role }) });
    renderOverview();
    expect(await screen.findByRole("columnheader", { name: "Without credentials" })).toBeVisible();
  });

  it("stacks Activity, Users, Credentials, Distribution and Chain Info for Issuer+", async () => {
    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
    renderOverview();
    await screen.findByRole("columnheader", { name: "Without credentials" });
    const activityCard = screen.getByRole("heading", { name: "Recent Activity" }).parentElement;
    const usersCard = screen.getByRole("heading", { name: "Users", level: 2 }).parentElement;
    const credentialsCard = screen.getByRole("heading", {
      name: "Credentials",
      level: 2,
    }).parentElement;
    const recapCard = screen
      .getByRole("heading", { name: "Credential Distribution" })
      .closest("[aria-label='Credential Distribution']");
    const chainCard = screen.getByRole("heading", { name: "Chain Info" }).parentElement;
    expect(activityCard?.nextElementSibling).toBe(usersCard);
    expect(usersCard?.nextElementSibling).toBe(credentialsCard);
    expect(credentialsCard?.nextElementSibling).toBe(recapCard);
    expect(recapCard?.nextElementSibling).toBe(chainCard);
    expect(chainCard?.querySelector("dl")).toHaveClass("sm:grid-cols-2", "lg:grid-cols-3");
  });

  it("places Activity before Credentials for Holder without privileged cards", async () => {
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderOverview();
    const activityCard = (await screen.findByRole("heading", { name: "Recent Activity" }))
      .parentElement;
    const credentialsCard = screen.getByRole("heading", {
      name: "Credentials",
      level: 2,
    }).parentElement;
    expect(activityCard?.nextElementSibling).toBe(credentialsCard);
    expect(screen.queryByRole("heading", { name: "Users", level: 2 })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Credential Distribution" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Chain Info" })).not.toBeInTheDocument();
  });

  it("keeps Distribution after Credentials when Chain Info is absent", async () => {
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
    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
    renderOverview();
    await screen.findByRole("columnheader", { name: "Without credentials" });
    const activityCard = screen.getByRole("heading", { name: "Recent Activity" }).parentElement;
    const credentialsCard = screen.getByRole("heading", {
      name: "Credentials",
      level: 2,
    }).parentElement;
    const recapCard = screen
      .getByRole("heading", { name: "Credential Distribution" })
      .closest("[aria-label='Credential Distribution']");
    expect(activityCard?.nextElementSibling).toBe(credentialsCard);
    expect(credentialsCard?.nextElementSibling).toBe(recapCard);
    expect(screen.queryByRole("heading", { name: "Chain Info" })).not.toBeInTheDocument();
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

  it("keeps a custom one-sided range in the URL and filter after changing an existing range", async () => {
    const u = userEvent.setup();
    const captured: string[][] = [];
    server.use(
      http.get("*/api/overview", ({ request }) => {
        captured.push(new URL(request.url).searchParams.getAll("filters"));
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
    render(
      <>
        <Overview />
        <SearchDisplay />
      </>,
      {
        wrapper: ({ children }) => (
          <TestProviders initialEntries={["/overview?date=..2026-01-01,2026-06-30"]}>
            {children}
          </TestProviders>
        ),
      },
    );
    await screen.findByText("Recent Activity");
    await u.click(screen.getByRole("button", { name: /date range/i }));
    await u.clear(screen.getByLabelText("To"));
    await u.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      expect(new URLSearchParams(screen.getByTestId("search").textContent ?? "").get("date")).toBe(
        "..2026-01-01,",
      );
      expect(captured.at(-1)).toContain("date..2026-01-01,");
    });
    await u.click(screen.getByRole("button", { name: /date range/i }));
    expect(screen.getByLabelText("From")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText("To")).toHaveValue("");
  });

  it("renders relative time for recent items and formatted dates for items older than 7 days", async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("*/api/overview", () =>
        HttpResponse.json({
          code: 100100,
          data: {
            credential_counts: { total: 10, active: 8, revoked: 2, pending: 0, failed: 0 },
            user_counts: {
              total: 5,
              holder: 3,
              issuer: 1,
              admin: 1,
              super_admin: 0,
              active: 5,
              trashed: 0,
            },
            recents: {
              active_credentials: [
                {
                  id: "c-recent",
                  name: "Recent Certificate",
                  issued_at: fiveMinutesAgo,
                },
              ],
              revoked_credentials: [
                {
                  id: "c-revoked",
                  name: "Revoked Days Ago",
                  issued_at: threeDaysAgo,
                  revoked_at: threeDaysAgo,
                },
              ],
              stored_users: [
                makeUser({
                  id: "u-old",
                  name: "Old User",
                  created_at: tenDaysAgo,
                }),
              ],
            },
          },
        }),
      ),
    );

    useStore.setState({ user: makeUser({ role: Role.ISSUER }) });
    renderOverview();

    const activity = (await screen.findByRole("heading", { name: "Recent Activity" }))
      .parentElement!;
    const registered = within(activity).getByRole("article", { name: "Recently Registered" });
    const revoked = within(activity).getByRole("article", { name: "Recently Revoked" });
    const user = within(activity).getByRole("article", { name: "New User" });

    expect(within(registered).getByText("5m ago")).toBeInTheDocument();
    expect(within(revoked).getByText("3d ago")).toBeInTheDocument();
    expect(within(user).getByText(formatDate(tenDaysAgo, "en"))).toBeInTheDocument();
  });
});
