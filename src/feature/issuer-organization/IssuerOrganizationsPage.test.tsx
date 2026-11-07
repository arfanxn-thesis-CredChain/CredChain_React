import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { makeUser } from "@/test/fixtures";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
import { IssuerOrganizationsPage } from "./IssuerOrganizationsPage";

const organizations = [
  { id: "iorg_01", name: "University of Indonesia", active: true, status: "approved" as const },
  { id: "iorg_02", name: "Tech Academy", active: false, status: "approved" as const },
];

const mockNotify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@shared/lib/notify", () => ({ notify: mockNotify }));

function paginated<T>(items: T[]) {
  return HttpResponse.json({
    code: 400600,
    message: "ok",
    data: {
      items,
      total: items.length,
      page: 1,
      limit: 100,
      last_page: 1,
      from: items.length ? 1 : 0,
      to: items.length,
      first_page_url: null,
      last_page_url: null,
      next_page_url: null,
      prev_page_url: null,
    },
  });
}

function renderPage() {
  return render(<IssuerOrganizationsPage />, { wrapper: TestProviders });
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockNotify.success.mockClear();
  mockNotify.error.mockClear();
  mockNotify.info.mockClear();
  useStore.setState({
    user: makeUser({ id: "usr_admin", role: Role.ADMIN }),
    isAuthenticated: true,
  });
});

describe("IssuerOrganizationsPage", () => {
  it("renders the page header and the list rows", async () => {
    server.use(http.get("*/api/issuer-organizations", () => paginated(organizations)));

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Issuer Organizations" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("University of Indonesia")).toBeInTheDocument();
    expect(await screen.findByText("Tech Academy")).toBeInTheDocument();
  });

  it("posts { name } when creating an issuer organization", async () => {
    let recordedBody: unknown;
    server.use(
      http.get("*/api/issuer-organizations", () => paginated(organizations)),
      http.post("*/api/issuer-organizations", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({
          code: 400901,
          message: "ok",
          data: { id: "iorg_new", name: "Polytechnic" },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("University of Indonesia");
    // The create row starts collapsed behind its trigger.
    await user.click(screen.getByRole("button", { name: "Add organization" }));
    await user.type(screen.getByPlaceholderText("Organization name"), "Polytechnic");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(recordedBody).toEqual({ name: "Polytechnic" }));
  });

  it("shows a destructive confirm and DELETEs the row when confirmed", async () => {
    const recorded: { method?: string; url?: string }[] = [];
    server.use(
      http.get("*/api/issuer-organizations", () => paginated(organizations)),
      http.delete("*/api/issuer-organizations/:id", ({ request }) => {
        recorded.push({ method: request.method, url: request.url });
        return HttpResponse.json({ code: 400903, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("University of Indonesia");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete University of Indonesia?");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(recorded[0]).toEqual({
        method: "DELETE",
        url: expect.stringContaining("/api/issuer-organizations/iorg_01") as unknown as string,
      });
    });
  });

  it("PUTs the flipped active flag when the row switch is toggled", async () => {
    let recordedBody: unknown;
    server.use(
      http.get("*/api/issuer-organizations", () => paginated(organizations)),
      http.put("*/api/issuer-organizations/:id", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 400902, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("switch", {
        name: "Toggle active state for University of Indonesia",
      }),
    );

    await waitFor(() =>
      expect(recordedBody).toEqual({ name: "University of Indonesia", active: false }),
    );
  });

  it("toasts the destroy-in-use error key on a guarded destroy", async () => {
    server.use(
      http.get("*/api/issuer-organizations", () => paginated(organizations)),
      http.delete("*/api/issuer-organizations/:id", () =>
        HttpResponse.json({ code: 400742, message: "In use" }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("University of Indonesia");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockNotify.error).toHaveBeenCalledWith("error_issuer_organization_destroy_in_use");
    });
  });

  it("supports inline editing to update issuer organization name", async () => {
    let putBody: unknown;
    server.use(
      http.get("*/api/issuer-organizations", () => paginated(organizations)),
      http.put("*/api/issuer-organizations/:id", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({
          code: 400902,
          message: "ok",
          data: { id: "iorg_01", name: "National University", active: true },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("University of Indonesia");
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    const input = screen.getByRole("textbox", { name: "Edit" });
    expect(input).toHaveValue("University of Indonesia");
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);

    await user.clear(input);
    await user.type(input, "National University");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(putBody).toEqual({ name: "National University", active: true });
    });
  });

  it("cancels inline editing when clicking cancel", async () => {
    server.use(http.get("*/api/issuer-organizations", () => paginated(organizations)));

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("University of Indonesia");
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    const input = screen.getByRole("textbox", { name: "Edit" });
    await user.clear(input);
    await user.type(input, "Changed Name");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByText("University of Indonesia")).toBeInTheDocument();
  });

  it("allows a holder to request a new issuer organization via submit", async () => {
    useStore.setState({
      user: makeUser({ id: "usr_holder", role: Role.HOLDER }),
      isAuthenticated: true,
    });

    let recordedBody: unknown;
    server.use(
      http.get("*/api/issuer-organizations", () => paginated(organizations)),
      http.post("*/api/issuer-organizations/submit", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({
          code: 400904,
          message: "ok",
          data: { id: "iorg_pending", name: "MIT", status: "pending", active: false },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("University of Indonesia");
    await user.click(screen.getByRole("button", { name: "Request New Organization" }));
    await user.type(screen.getByPlaceholderText("Organization name"), "MIT");
    await user.click(screen.getByRole("button", { name: "Request" }));

    await waitFor(() => expect(recordedBody).toEqual({ name: "MIT" }));
  });

  it("allows issuer+ to approve or reject a pending issuer organization", async () => {
    useStore.setState({
      user: makeUser({ id: "usr_issuer", role: Role.ISSUER }),
      isAuthenticated: true,
    });

    const pendingRow = {
      id: "iorg_pending_01",
      name: "Stanford University",
      status: "pending" as const,
      active: false,
    };

    let approveCalled = false;
    server.use(
      http.get("*/api/issuer-organizations", () => paginated([pendingRow])),
      http.post("*/api/issuer-organizations/:id/approve", () => {
        approveCalled = true;
        return HttpResponse.json({ code: 400905, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /^Pending review/ }));

    await screen.findByText("Stanford University");
    expect(screen.getByText("Pending")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(approveCalled).toBe(false);
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Approve" }),
    );

    await waitFor(() => expect(approveCalled).toBe(true));
  });
});
