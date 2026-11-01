import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { makeUser, makeCredentialNotification } from "@/test/fixtures";
import { i18n } from "@shared/i18n/config";
import { formatDateTime } from "@shared/lib/format";
import { CredentialNotificationsPage } from "./CredentialNotificationsPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("CredentialNotificationsPage", () => {
  const mockHolder = makeUser({ id: "usr_h1", role: Role.HOLDER, name: "Alice Holder" });
  const mockIssuer = makeUser({ id: "usr_i1", role: Role.ISSUER, name: "Bob Issuer" });

  beforeEach(() => {
    void i18n.changeLanguage("en");
    mockNavigate.mockClear();
    useStore.setState({ user: mockHolder, isAuthenticated: true });
  });

  it("renders PageHeader with Notifications title and Mark all read button", async () => {
    render(<CredentialNotificationsPage />, { wrapper: TestProviders });
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeInTheDocument();
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
  });

  function mockFeed(items: ReturnType<typeof makeCredentialNotification>[]) {
    server.use(
      http.get("*/api/credential-notifications", () =>
        HttpResponse.json({
          code: 400100,
          message: "OK",
          data: { items, total: items.length, next_cursor: null },
        }),
      ),
    );
  }

  it.each(["en", "id"])(
    "renders minimalist localized sentences and back control in %s",
    async (locale) => {
      await i18n.changeLanguage(locale);
      const types = ["registered", "approved", "rejected", "revoked"] as const;
      mockFeed(
        types.map((type) =>
          makeCredentialNotification({
            id: type,
            type,
            credential: { id: `cred_${type}`, name: `Name ${type}`, number: "HIDDEN-123" },
          }),
        ),
      );
      const { container } = render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      for (const type of types) {
        const name = await screen.findByText(`Name ${type}`);
        expect(name.tagName).toBe("STRONG");
        expect(name.parentElement).toHaveClass("font-normal");
        const sentences =
          locale === "en"
            ? {
                registered: "Your credential Name registered has been registered.",
                approved: "Your credential Name approved has been approved.",
                rejected: "Your credential submission Name rejected was rejected.",
                revoked: "Your credential Name revoked has been revoked.",
              }
            : {
                registered: "Kredensial Anda Name registered telah didaftarkan.",
                approved: "Kredensial Anda Name approved telah disetujui.",
                rejected: "Pengajuan kredensial Anda Name rejected ditolak.",
                revoked: "Kredensial Anda Name revoked telah dicabut.",
              };
        expect(name.parentElement?.textContent).toBe(sentences[type]);
        expect(screen.queryByText(i18n.t(`notifications.type.${type}`))).not.toBeInTheDocument();
      }
      expect(screen.queryByText("HIDDEN-123")).not.toBeInTheDocument();
      const rejectedIcon = screen
        .getByText("Name rejected")
        .closest("button")
        ?.querySelector("svg");
      const revokedIcon = screen.getByText("Name revoked").closest("button")?.querySelector("svg");
      expect(rejectedIcon).not.toBeNull();
      expect(rejectedIcon?.innerHTML).toBe(revokedIcon?.innerHTML);
      expect(container.querySelectorAll("strong")).toHaveLength(4);
      expect(
        screen.getByRole("button", { name: locale === "en" ? "Back" : "Kembali" }),
      ).toBeInTheDocument();
    },
  );

  it.each(["en", "id"])("renders compact accessible read actions in %s", async (locale) => {
    await i18n.changeLanguage(locale);
    mockFeed([
      makeCredentialNotification({
        id: "unread_available",
        read_at: null,
        credential: { id: "cred_unread", name: "Unread credential", number: null },
      }),
      makeCredentialNotification({ id: "unread_unavailable", read_at: null, credential: null }),
      makeCredentialNotification({
        id: "read_available",
        read_at: "2026-01-01T00:00:00Z",
        credential: { id: "cred_read", name: "Read credential", number: null },
      }),
    ]);
    render(<CredentialNotificationsPage />, { wrapper: TestProviders });
    await screen.findByText("Unread credential");
    const label = i18n.t("notifications.markRead");
    const actions = screen.getAllByRole("button", { name: label });
    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action).toHaveAttribute("aria-label", label);
      expect(action).toHaveAttribute("title", label);
      expect(action).toHaveClass("h-11", "w-11", "shrink-0", "sm:w-auto", "whitespace-nowrap");
      expect(action).not.toHaveClass("max-w-28", "whitespace-normal", "h-auto");
      expect(within(action).getByText(label)).toHaveClass("hidden", "sm:inline");
      expect(action.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      const row = action.closest("li")!;
      expect(row).toHaveClass("items-center");
      expect(within(row).getAllByRole("button", { name: label })).toHaveLength(1);
    }
    const readRow = screen.getByText("Read credential").closest("li")!;
    expect(
      within(readRow).queryByRole("button", { name: label }),
    ).not.toBeInTheDocument();
  });

  it("uses smart-back fallback", async () => {
    render(<CredentialNotificationsPage />, { wrapper: TestProviders });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(mockNavigate).toHaveBeenCalledWith("/overview");
  });

  it("renders markup-like names literally and supports keyboard search by ID", async () => {
    const name = "A & B <img src=x> <strong>not markup</strong>";
    const credentialId = "precise_id&scope=other /?";
    mockFeed([
      makeCredentialNotification({
        read_at: "2026-01-01T00:00:00Z",
        credential: { id: credentialId, name, number: null },
      }),
    ]);
    const { container } = render(<CredentialNotificationsPage />, { wrapper: TestProviders });
    const text = await screen.findByText(name);
    expect(text.tagName).toBe("STRONG");
    expect(text.querySelector("strong, img")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    const target = screen.getByRole("button", { name: new RegExp("A & B") });
    target.focus();
    await userEvent.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledOnce();
    const destination = new URL(mockNavigate.mock.calls[0][0], "http://localhost");
    expect(destination.pathname).toBe("/credentials");
    expect([...destination.searchParams.entries()]).toEqual([["search", credentialId]]);
  });

  it.each(["en", "id"])("formats relative and absolute timestamps in %s", async (locale) => {
    await i18n.changeLanguage(locale);
    const now = Date.parse("2026-10-20T12:00:00Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    const ages = [
      10_000,
      60_000,
      3_600_000,
      86_400_000,
      7 * 86_400_000 - 1,
      7 * 86_400_000,
      10 * 86_400_000,
      -60_000,
    ];
    const dates = ages.map((age) => new Date(now - age).toISOString());
    mockFeed(
      [...dates, "invalid"].map((created_at, index) =>
        makeCredentialNotification({ id: `time_${index}`, created_at, credential: null }),
      ),
    );
    const { container } = render(<CredentialNotificationsPage />, { wrapper: TestProviders });
    await waitFor(() => expect(container.querySelectorAll("time")).toHaveLength(9));
    const times = [...container.querySelectorAll("time")];
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
    const expected = [
      relative.format(-10, "second"),
      relative.format(-1, "minute"),
      relative.format(-1, "hour"),
      relative.format(-1, "day"),
      relative.format(-6, "day"),
      formatDateTime(dates[5], locale),
      formatDateTime(dates[6], locale),
      relative.format(-0, "second"),
      "-",
    ];
    times.forEach((time, index) => expect(time.textContent).toBe(expected[index]));
    expect(times[0]).toHaveAttribute("datetime", dates[0]);
    expect(times[0]).toHaveAttribute("title", formatDateTime(dates[0], locale));
    expect(times[8]).not.toHaveAttribute("datetime");
    expect(times[8]).not.toHaveAttribute("title");
  });

  it("loads the next cursor and appends rows", async () => {
    let cursor: string | null = null;
    server.use(
      http.get("*/api/credential-notifications", ({ request }) => {
        cursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json({
          code: 400100,
          message: "OK",
          data: {
            items: [
              makeCredentialNotification({
                id: cursor ? "second" : "first",
                credential: {
                  id: cursor ? "cred_second" : "cred_first",
                  name: cursor ? "Second credential" : "First credential",
                  number: null,
                },
              }),
            ],
            total: 2,
            next_cursor: cursor ? null : "next_page",
          },
        });
      }),
    );
    render(<CredentialNotificationsPage />, { wrapper: TestProviders });
    await screen.findByText("First credential");
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(await screen.findByText("Second credential")).toBeInTheDocument();
    expect(screen.getByText("First credential")).toBeInTheDocument();
    expect(cursor).toBe("next_page");
  });

  describe("Issuer+ workload card", () => {
    it("does NOT render pending review card for Holder", async () => {
      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      await waitFor(() => {
        expect(screen.queryByText(/awaiting review/i)).not.toBeInTheDocument();
      });
    });

    it("renders pending review card with count for Issuer linking to /credentials?review=pending", async () => {
      useStore.setState({ user: mockIssuer, isAuthenticated: true });
      server.use(
        http.get("*/api/credentials", ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("limit") === "1") {
            return HttpResponse.json({
              code: 400100,
              message: "OK",
              data: { items: [], total: 15 },
            });
          }
          return HttpResponse.json({ code: 400100, message: "OK", data: { items: [], total: 0 } });
        }),
      );

      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      expect(await screen.findByText(/awaiting review/i)).toBeInTheDocument();
      expect(screen.getByText(/15 credentials awaiting review/i)).toBeInTheDocument();

      const reviewLink = screen.getByRole("link", { name: /review now/i });
      expect(reviewLink).toHaveAttribute("href", "/credentials?review=pending");
    });

    it("renders compact state when pending review count is 0", async () => {
      useStore.setState({ user: mockIssuer, isAuthenticated: true });
      server.use(
        http.get("*/api/credentials", ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("limit") === "1") {
            return HttpResponse.json({
              code: 400100,
              message: "OK",
              data: { items: [], total: 0 },
            });
          }
          return HttpResponse.json({ code: 400100, message: "OK", data: { items: [], total: 0 } });
        }),
      );

      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      expect(await screen.findByText(/no credentials awaiting review/i)).toBeInTheDocument();
    });

    it("renders retry button on pending review count error", async () => {
      useStore.setState({ user: mockIssuer, isAuthenticated: true });
      server.use(
        http.get("*/api/credentials", ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("limit") === "1") {
            return HttpResponse.json({ code: 500, message: "Internal Error" }, { status: 500 });
          }
          return HttpResponse.json({ code: 400100, message: "OK", data: { items: [], total: 0 } });
        }),
      );

      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      expect(await screen.findByText(/unable to load review count/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe("Personal notifications feed", () => {
    const notifRegistered = makeCredentialNotification({
      id: "notif_reg",
      type: "registered",
      read_at: null,
      credential: { id: "cred_reg", name: "Degree of Computer Science", number: "CS-2026" },
    });
    const notifApproved = makeCredentialNotification({
      id: "notif_app",
      type: "approved",
      read_at: "2026-06-20T12:00:00Z",
      credential: { id: "cred_app", name: "AI Certification", number: null },
    });
    const notifUnavailable = makeCredentialNotification({
      id: "notif_unav",
      type: "revoked",
      read_at: null,
      credential: null,
    });

    beforeEach(() => {
      server.use(
        http.get("*/api/credential-notifications", ({ request }) => {
          const url = new URL(request.url);
          const status = url.searchParams.get("status");
          let items = [notifRegistered, notifApproved, notifUnavailable];
          if (status === "unread") {
            items = items.filter((i) => i.read_at === null);
          }
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: { items, total: items.length, next_cursor: null },
          });
        }),
      );
    });

    it("renders notification items with types and credential summaries", async () => {
      render(<CredentialNotificationsPage />, { wrapper: TestProviders });

      expect(await screen.findByText("Degree of Computer Science")).toBeInTheDocument();
      expect(screen.queryByText("CS-2026")).not.toBeInTheDocument();
      expect(screen.getByText("Degree of Computer Science").tagName).toBe("STRONG");
      expect(screen.getByText("AI Certification")).toBeInTheDocument();
      expect(screen.getByText("Credential unavailable")).toBeInTheDocument();
    });

    it("switches filter between All and Unread tabs", async () => {
      render(<CredentialNotificationsPage />, { wrapper: TestProviders });

      expect(await screen.findByText("Degree of Computer Science")).toBeInTheDocument();
      expect(screen.getByText("AI Certification")).toBeInTheDocument();

      const unreadTab = screen.getByRole("tab", { name: /unread/i });
      await userEvent.click(unreadTab);

      await waitFor(() => {
        expect(screen.queryByText("AI Certification")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Degree of Computer Science")).toBeInTheDocument();
    });

    it("clicking notification with credential marks read and navigates to credential search", async () => {
      let markedId: string | null = null;
      server.use(
        http.put("*/api/credential-notifications/:id/read", ({ params }) => {
          markedId = params.id as string;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: makeCredentialNotification({ id: markedId, read_at: "2026-06-20T14:00:00Z" }),
          });
        }),
      );

      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      const credElement = await screen.findByText("Degree of Computer Science");
      await userEvent.click(credElement);

      expect(mockNavigate).toHaveBeenCalledWith("/credentials?search=cred_reg");
      await waitFor(() => expect(markedId).toBe("notif_reg"));
    });

    it("navigates even if markRead mutation fails", async () => {
      server.use(
        http.put("*/api/credential-notifications/:id/read", () => {
          return HttpResponse.json({ code: 500, message: "Server error" }, { status: 500 });
        }),
      );

      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      const credElement = await screen.findByText("Degree of Computer Science");
      await userEvent.click(credElement);

      expect(mockNavigate).toHaveBeenCalledWith("/credentials?search=cred_reg");
    });

    it("notification with null credential does NOT navigate on click", async () => {
      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      const unavailableElement = await screen.findByText("Credential unavailable");
      await userEvent.click(unavailableElement);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("mark one notification read via button", async () => {
      let markedId: string | null = null;
      server.use(
        http.put("*/api/credential-notifications/:id/read", ({ params }) => {
          markedId = params.id as string;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: makeCredentialNotification({ id: markedId, read_at: "2026-06-20T14:00:00Z" }),
          });
        }),
      );

      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      await screen.findByText("Degree of Computer Science");

      const markReadButtons = screen.getAllByRole("button", { name: /mark as read/i });
      await userEvent.click(markReadButtons[0]);

      await waitFor(() => expect(markedId).toBe("notif_reg"));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("marks unavailable notifications read without navigating", async () => {
      let markedId: string | null = null;
      server.use(
        http.put("*/api/credential-notifications/:id/read", ({ params }) => {
          markedId = params.id as string;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: makeCredentialNotification({
              id: markedId,
              read_at: "2026-06-20T14:00:00Z",
              credential: null,
            }),
          });
        }),
      );
      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      const unavailable = await screen.findByText("Credential unavailable");
      const row = unavailable.closest("li");
      expect(row).not.toBeNull();
      const markButton = row?.querySelector("button");
      expect(markButton).not.toBeNull();
      await userEvent.click(markButton!);
      await waitFor(() => expect(markedId).toBe("notif_unav"));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("mark all read via header button", async () => {
      let called = false;
      server.use(
        http.put("*/api/credential-notifications/read-all", () => {
          called = true;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: { updated_count: 2 },
          });
        }),
      );

      render(<CredentialNotificationsPage />, { wrapper: TestProviders });
      await screen.findByText("Degree of Computer Science");

      const markAllBtn = screen.getByRole("button", { name: /mark all as read/i });
      await userEvent.click(markAllBtn);

      await waitFor(() => expect(called).toBe(true));
    });
  });
});
