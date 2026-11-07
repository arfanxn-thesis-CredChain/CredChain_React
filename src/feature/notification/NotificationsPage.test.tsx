import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { makeUser, makeNotification } from "@/test/fixtures";
import { i18n } from "@shared/i18n/config";
import { formatDateTime } from "@shared/lib/format";
import { NotificationsPage } from "./NotificationsPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("NotificationsPage", () => {
  const mockHolder = makeUser({ id: "usr_h1", role: Role.HOLDER, name: "Alice Holder" });
  const mockIssuer = makeUser({ id: "usr_i1", role: Role.ISSUER, name: "Bob Issuer" });

  beforeEach(() => {
    void i18n.changeLanguage("en");
    mockNavigate.mockClear();
    useStore.setState({ user: mockHolder, isAuthenticated: true });
  });

  it("renders PageHeader with Notifications title and Mark all read button", async () => {
    render(<NotificationsPage />, { wrapper: TestProviders });
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeInTheDocument();
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
  });

  function mockFeed(items: ReturnType<typeof makeNotification>[]) {
    server.use(
      http.get("*/api/notifications", () =>
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
          makeNotification({
            id: type,
            type: `credential_${type}`,
            subject: { id: `cred_${type}`, name: `Name ${type}`, number: "HIDDEN-123" },
          }),
        ),
      );
      const { container } = render(<NotificationsPage />, { wrapper: TestProviders });
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
      makeNotification({
        id: "unread_available",
        read_at: null,
        subject: { id: "cred_unread", name: "Unread credential", number: null },
      }),
      makeNotification({ id: "unread_unavailable", read_at: null, subject: null }),
      makeNotification({
        id: "read_available",
        read_at: "2026-01-01T00:00:00Z",
        subject: { id: "cred_read", name: "Read credential", number: null },
      }),
    ]);
    render(<NotificationsPage />, { wrapper: TestProviders });
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
    expect(within(readRow).queryByRole("button", { name: label })).not.toBeInTheDocument();
  });

  it("uses smart-back fallback", async () => {
    render(<NotificationsPage />, { wrapper: TestProviders });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(mockNavigate).toHaveBeenCalledWith("/overview");
  });

  it("renders markup-like names literally and supports keyboard search by ID", async () => {
    const name = "A & B <img src=x> <strong>not markup</strong>";
    const credentialId = "precise_id&scope=other /?";
    mockFeed([
      makeNotification({
        read_at: "2026-01-01T00:00:00Z",
        subject: { id: credentialId, name, number: null },
      }),
    ]);
    const { container } = render(<NotificationsPage />, { wrapper: TestProviders });
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
        makeNotification({ id: `time_${index}`, created_at, subject: null }),
      ),
    );
    const { container } = render(<NotificationsPage />, { wrapper: TestProviders });
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
      http.get("*/api/notifications", ({ request }) => {
        cursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json({
          code: 400100,
          message: "OK",
          data: {
            items: [
              makeNotification({
                id: cursor ? "second" : "first",
                subject: {
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
    render(<NotificationsPage />, { wrapper: TestProviders });
    await screen.findByText("First credential");
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(await screen.findByText("Second credential")).toBeInTheDocument();
    expect(screen.getByText("First credential")).toBeInTheDocument();
    expect(cursor).toBe("next_page");
  });

  it.each([
    ["credential_type", "credential-types"],
    ["credential_issuer_organization", "credential-issuer-organizations"],
    ["competency", "competencies"],
  ] as const)(
    "opens resolved %s history with a literal current name",
    async (subject_type, path) => {
      const name = "A & B <img src=x> /?";
      mockFeed([
        makeNotification({
          subject_type,
          subject_id: "reference",
          type: `${subject_type}_submitted`,
          subject: { id: "reference", name, number: null, status: "rejected" },
          read_at: "2026-01-01T00:00:00Z",
        }),
      ]);
      const { container } = render(<NotificationsPage />, { wrapper: TestProviders });
      const text = await screen.findByText(name);
      expect(container.querySelector("img")).toBeNull();
      await userEvent.click(text);
      const destination = new URL(mockNavigate.mock.calls[0][0], "http://localhost");
      expect(destination.pathname).toBe(`/${path}`);
      expect([...destination.searchParams.entries()]).toEqual([
        ["status", "all"],
        ["search", name],
      ]);
    },
  );

  it.each([
    "credential_registered",
    "credential_approved",
    "credential_rejected",
    "credential_revoked",
    "credential_type_submitted",
    "credential_issuer_organization_submitted",
    "competency_submitted",
  ] as const)("renders and marks subjectless %s without navigation", async (type) => {
    mockFeed([makeNotification({ type, subject_type: null, subject_id: null, subject: null })]);
    let marked = false;
    server.use(
      http.put("*/api/notifications/:id/read", () => {
        marked = true;
        return HttpResponse.json({
          code: 401602,
          data: makeNotification({ read_at: "2026-01-01T00:00:00Z" }),
        });
      }),
    );
    render(<NotificationsPage />, { wrapper: TestProviders });
    const message = await screen.findByText(i18n.t(`notifications.subjectless.${type}`));
    expect(message.closest("button")).toBeNull();
    await userEvent.click(
      within(message.closest("li")!).getByRole("button", { name: "Mark as read" }),
    );
    await waitFor(() => expect(marked).toBe(true));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps missing reference subjects unavailable and noninteractive", async () => {
    mockFeed([
      makeNotification({
        subject_type: "competency",
        subject_id: "missing",
        type: "competency_submitted",
        subject: null,
      }),
    ]);
    render(<NotificationsPage />, { wrapper: TestProviders });
    const message = await screen.findByText("Subject unavailable");
    expect(message.closest("button")).toBeNull();
    await userEvent.click(message);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows three independent reference totals and pending queue links", async () => {
    useStore.setState({ user: mockIssuer });
    for (const [path, total] of [
      ["credential-types", 0],
      ["issuer-organizations", 3],
      ["competencies", 7],
    ] as const) {
      server.use(
        http.get(`*/api/${path}`, () =>
          HttpResponse.json({ code: 100000, data: { items: [], total } }),
        ),
      );
    }
    render(<NotificationsPage />, { wrapper: TestProviders });
    for (const [label, path, count] of [
      ["Credential types", "credential-types", 0],
      ["Issuer organizations", "credential-issuer-organizations", 3],
      ["Competencies", "competencies", 7],
    ] as const) {
      const heading = screen.getByRole("heading", { name: label });
      await waitFor(() =>
        expect(heading.parentElement).toHaveTextContent(`${count} items awaiting review`),
      );
      expect(screen.getByRole("link", { name: `Review ${label}` })).toHaveAttribute(
        "href",
        `/${path}?status=pending`,
      );
    }
  });

  it("uses matching icon-free summary rows and touch-sized actions for all four queues", async () => {
    useStore.setState({ user: mockIssuer });
    for (const path of [
      "credentials",
      "credential-types",
      "issuer-organizations",
      "competencies",
    ]) {
      server.use(
        http.get(`*/api/${path}`, () =>
          HttpResponse.json({ code: 100000, data: { items: [], total: 2 } }),
        ),
      );
    }
    render(<NotificationsPage />, { wrapper: TestProviders });
    await screen.findByText("2 credentials awaiting review");
    for (const label of [
      "Pending reviews",
      "Credential types",
      "Issuer organizations",
      "Competencies",
    ]) {
      const heading = screen.getByRole("heading", { name: label });
      const row = heading.parentElement!.parentElement!;
      expect(row.querySelector(".lucide-clock")).toBeNull();
      expect(heading).toHaveClass("font-bold");
      const action = within(row).getByRole("link");
      expect(action).toHaveClass("h-11");
      expect(action.querySelector(".lucide-external-link")).not.toBeNull();
    }
  });

  it("keeps reference count failures distinct from zero and retries", async () => {
    useStore.setState({ user: mockIssuer });
    let failed = true;
    server.use(
      http.get("*/api/competencies", () =>
        failed
          ? HttpResponse.json({}, { status: 500 })
          : HttpResponse.json({ code: 100000, data: { items: [], total: 0 } }),
      ),
    );
    render(<NotificationsPage />, { wrapper: TestProviders });
    const retry = await screen.findByRole("button", {
      name: "Retry review count for Competencies",
    });
    expect(screen.getByRole("heading", { name: "Competencies" }).parentElement).toHaveTextContent(
      "Unable to load review count.",
    );
    failed = false;
    await userEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Competencies" }).parentElement).toHaveTextContent(
        "0 items awaiting review",
      ),
    );
  });

  describe("Issuer+ workload card", () => {
    it("does NOT render pending review card for Holder", async () => {
      render(<NotificationsPage />, { wrapper: TestProviders });
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

      render(<NotificationsPage />, { wrapper: TestProviders });
      expect(await screen.findByText(/15 credentials awaiting review/i)).toBeInTheDocument();
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

      render(<NotificationsPage />, { wrapper: TestProviders });
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

      render(<NotificationsPage />, { wrapper: TestProviders });
      expect(await screen.findByText(/unable to load review count/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe("Personal notifications feed", () => {
    const notifRegistered = makeNotification({
      id: "notif_reg",
      type: "credential_registered",
      read_at: null,
      subject: { id: "cred_reg", name: "Degree of Computer Science", number: "CS-2026" },
    });
    const notifApproved = makeNotification({
      id: "notif_app",
      type: "credential_approved",
      read_at: "2026-06-20T12:00:00Z",
      subject: { id: "cred_app", name: "AI Certification", number: null },
    });
    const notifUnavailable = makeNotification({
      id: "notif_unav",
      type: "credential_revoked",
      read_at: null,
      subject: null,
    });

    beforeEach(() => {
      server.use(
        http.get("*/api/notifications", ({ request }) => {
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
      render(<NotificationsPage />, { wrapper: TestProviders });

      expect(await screen.findByText("Degree of Computer Science")).toBeInTheDocument();
      expect(screen.queryByText("CS-2026")).not.toBeInTheDocument();
      expect(screen.getByText("Degree of Computer Science").tagName).toBe("STRONG");
      expect(screen.getByText("AI Certification")).toBeInTheDocument();
      expect(screen.getByText("Credential unavailable")).toBeInTheDocument();
    });

    it("switches filter between All and Unread tabs", async () => {
      render(<NotificationsPage />, { wrapper: TestProviders });

      expect(await screen.findByText("Degree of Computer Science")).toBeInTheDocument();
      expect(screen.getByText("AI Certification")).toBeInTheDocument();

      const unreadTab = screen.getByRole("tab", { name: /unread/i });
      await userEvent.click(unreadTab);

      await waitFor(() => {
        expect(screen.queryByText("AI Certification")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Degree of Computer Science")).toBeInTheDocument();
    });

    it("supports arrow, Home, and End keys with one tabbable filter", async () => {
      render(<NotificationsPage />, { wrapper: TestProviders });
      const all = screen.getByRole("tab", { name: "All" });
      const unread = screen.getByRole("tab", { name: "Unread" });
      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(all).toHaveAttribute("tabindex", "0");
      expect(unread).toHaveAttribute("tabindex", "-1");
      all.focus();
      await userEvent.keyboard("{ArrowRight}");
      expect(unread).toHaveFocus();
      expect(unread).toHaveAttribute("aria-selected", "true");
      await userEvent.keyboard("{Home}");
      expect(all).toHaveFocus();
      await userEvent.keyboard("{End}");
      expect(unread).toHaveFocus();
      expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", unread.id);
    });

    it("clicking notification with credential marks read and navigates to credential search", async () => {
      let markedId: string | null = null;
      server.use(
        http.put("*/api/notifications/:id/read", ({ params }) => {
          markedId = params.id as string;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: makeNotification({ id: markedId, read_at: "2026-06-20T14:00:00Z" }),
          });
        }),
      );

      render(<NotificationsPage />, { wrapper: TestProviders });
      const credElement = await screen.findByText("Degree of Computer Science");
      await userEvent.click(credElement);

      expect(mockNavigate).toHaveBeenCalledWith("/credentials?search=cred_reg");
      await waitFor(() => expect(markedId).toBe("notif_reg"));
    });

    it("navigates even if markRead mutation fails", async () => {
      server.use(
        http.put("*/api/notifications/:id/read", () => {
          return HttpResponse.json({ code: 500, message: "Server error" }, { status: 500 });
        }),
      );

      render(<NotificationsPage />, { wrapper: TestProviders });
      const credElement = await screen.findByText("Degree of Computer Science");
      await userEvent.click(credElement);

      expect(mockNavigate).toHaveBeenCalledWith("/credentials?search=cred_reg");
    });

    it("notification with null credential does NOT navigate on click", async () => {
      render(<NotificationsPage />, { wrapper: TestProviders });
      const unavailableElement = await screen.findByText("Credential unavailable");
      await userEvent.click(unavailableElement);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("mark one notification read via button", async () => {
      let markedId: string | null = null;
      server.use(
        http.put("*/api/notifications/:id/read", ({ params }) => {
          markedId = params.id as string;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: makeNotification({ id: markedId, read_at: "2026-06-20T14:00:00Z" }),
          });
        }),
      );

      render(<NotificationsPage />, { wrapper: TestProviders });
      await screen.findByText("Degree of Computer Science");

      const markReadButtons = screen.getAllByRole("button", { name: /mark as read/i });
      await userEvent.click(markReadButtons[0]);

      await waitFor(() => expect(markedId).toBe("notif_reg"));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("marks unavailable notifications read without navigating", async () => {
      let markedId: string | null = null;
      server.use(
        http.put("*/api/notifications/:id/read", ({ params }) => {
          markedId = params.id as string;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: makeNotification({
              id: markedId,
              read_at: "2026-06-20T14:00:00Z",
              subject: null,
            }),
          });
        }),
      );
      render(<NotificationsPage />, { wrapper: TestProviders });
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
        http.put("*/api/notifications/read-all", () => {
          called = true;
          return HttpResponse.json({
            code: 400100,
            message: "OK",
            data: { updated_count: 2 },
          });
        }),
      );

      render(<NotificationsPage />, { wrapper: TestProviders });
      await screen.findByText("Degree of Computer Science");

      const markAllBtn = screen.getByRole("button", { name: /mark all as read/i });
      await userEvent.click(markAllBtn);

      await waitFor(() => expect(called).toBe(true));
    });
  });
});
