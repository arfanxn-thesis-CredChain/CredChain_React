import { render, screen, waitFor } from "@testing-library/react";
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
  { id: "iorg_01", name: "University of Indonesia" },
  { id: "iorg_02", name: "Tech Academy" },
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
    data: items,
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

    expect(await screen.findByRole("heading", { name: "Issuer Organizations" })).toBeInTheDocument();
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
    await user.type(screen.getByPlaceholderText("Organization name"), "Polytechnic");
    await user.click(screen.getByRole("button", { name: "Add organization" }));

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
    await user.click(screen.getAllByRole("button", { name: "Issuer organization actions" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

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
    await user.click(screen.getAllByRole("button", { name: "Issuer organization actions" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockNotify.error).toHaveBeenCalledWith("error_issuer_organization_destroy_in_use");
    });
  });
});
