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
import { CompetenciesPage } from "./CompetenciesPage";

const competencies = [
  { id: "comp_01", name: "Machine Learning", active: true },
  { id: "comp_02", name: "Data Analysis", active: false },
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
      limit: 50,
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
  return render(<CompetenciesPage />, { wrapper: TestProviders });
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

describe("CompetenciesPage", () => {
  it("renders the page header and the list rows", async () => {
    server.use(http.get("*/api/competencies", () => paginated(competencies)));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Competencies" })).toBeInTheDocument();
    expect(await screen.findByText("Machine Learning")).toBeInTheDocument();
    expect(await screen.findByText("Data Analysis")).toBeInTheDocument();
  });

  it("posts { name } when creating a competency", async () => {
    let recordedBody: unknown;
    server.use(
      http.get("*/api/competencies", () => paginated(competencies)),
      http.post("*/api/competencies", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({
          code: 401001,
          message: "ok",
          data: { id: "comp_new", name: "Leadership" },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Machine Learning");
    // The create row starts collapsed behind its trigger.
    await user.click(screen.getByRole("button", { name: "Add competency" }));
    await user.type(screen.getByPlaceholderText("Competency name"), "Leadership");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(recordedBody).toEqual({ name: "Leadership" }));
  });

  it("shows a destructive confirm and DELETEs the row when confirmed", async () => {
    const recorded: { method?: string; url?: string }[] = [];
    server.use(
      http.get("*/api/competencies", () => paginated(competencies)),
      http.delete("*/api/competencies/:id", ({ request }) => {
        recorded.push({ method: request.method, url: request.url });
        return HttpResponse.json({ code: 401003, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Machine Learning");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete Machine Learning?");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(recorded[0]).toEqual({
        method: "DELETE",
        url: expect.stringContaining("/api/competencies/comp_01") as unknown as string,
      });
    });
  });

  it("PUTs the flipped active flag when an inactive row switch is toggled", async () => {
    let recordedBody: unknown;
    server.use(
      http.get("*/api/competencies", () => paginated(competencies)),
      http.put("*/api/competencies/:id", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401002, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // comp_02 is seeded inactive, so this asserts the reactivation direction.
    await user.click(
      await screen.findByRole("switch", { name: "Toggle active state for Data Analysis" }),
    );

    await waitFor(() => expect(recordedBody).toEqual({ name: "Data Analysis", active: true }));
  });

  it("supports inline editing to update competency name", async () => {
    let putBody: unknown;
    server.use(
      http.get("*/api/competencies", () => paginated(competencies)),
      http.put("*/api/competencies/:id", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({
          code: 401002,
          message: "ok",
          data: { id: "comp_01", name: "Deep Learning", active: true },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Machine Learning");
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    const input = screen.getByRole("textbox", { name: "Edit" });
    expect(input).toHaveValue("Machine Learning");
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);

    await user.clear(input);
    await user.type(input, "Deep Learning");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(putBody).toEqual({ name: "Deep Learning", active: true });
    });
  });

  it("cancels inline editing when clicking cancel", async () => {
    server.use(http.get("*/api/competencies", () => paginated(competencies)));

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Machine Learning");
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    const input = screen.getByRole("textbox", { name: "Edit" });
    await user.clear(input);
    await user.type(input, "Changed Name");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
  });
});
