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
import { CredentialTypesPage } from "./CredentialTypesPage";

const mockNotify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@shared/lib/notify", () => ({ notify: mockNotify }));

const types = [
  { id: "ctype_01", name: "Bachelor's Degree", active: true },
  { id: "ctype_02", name: "Professional Certificate", active: false },
];

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
  return render(<CredentialTypesPage />, { wrapper: TestProviders });
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

describe("CredentialTypesPage", () => {
  it("renders the page header and the list rows", async () => {
    server.use(http.get("*/api/credential-types", () => paginated(types)));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Credential Types" })).toBeInTheDocument();
    expect(await screen.findByText("Bachelor's Degree")).toBeInTheDocument();
    expect(await screen.findByText("Professional Certificate")).toBeInTheDocument();
  });

  it("posts { name } when creating a credential type", async () => {
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credential-types", () => paginated(types)),
      http.post("*/api/credential-types", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({
          code: 400801,
          message: "ok",
          data: { id: "ctype_new", name: "Diploma" },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Bachelor's Degree");
    // The create row starts collapsed behind its trigger.
    await user.click(screen.getByRole("button", { name: "Add type" }));
    await user.type(screen.getByPlaceholderText("Type name"), "Diploma");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(recordedBody).toEqual({ name: "Diploma" }));
  });

  it("shows a destructive confirm and DELETEs the row when confirmed", async () => {
    const recorded: { method?: string; url?: string }[] = [];
    server.use(
      http.get("*/api/credential-types", () => paginated(types)),
      http.delete("*/api/credential-types/:id", ({ request }) => {
        recorded.push({ method: request.method, url: request.url });
        return HttpResponse.json({ code: 400803, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Bachelor's Degree");
    await user.click(screen.getAllByRole("button", { name: "Credential type actions" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete Bachelor's Degree?");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(recorded[0]).toEqual({ method: "DELETE", url: expect.stringContaining("/api/credential-types/ctype_01") as unknown as string });
    });
  });

  it("surfaces the destroy-in-use error code via toast on deactivation", async () => {
    server.use(
      http.get("*/api/credential-types", () => paginated(types)),
      http.put("*/api/credential-types/:id", () =>
        HttpResponse.json({ code: 400741, message: "In use" }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    const switchElement = await screen.findByRole("switch", {
      name: "Toggle active state for Bachelor's Degree",
    });
    await user.click(switchElement);

    await waitFor(() => {
      expect(mockNotify.error).toHaveBeenCalledWith("error_credential_type_destroy_in_use");
    });
  });
});
