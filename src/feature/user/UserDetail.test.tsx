import { beforeEach, describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { makeUser } from "@/test/fixtures";
import { server } from "@/test/msw/server";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { UserDetail } from "./UserDetail";

beforeAll(() => i18n.changeLanguage("en"));
afterAll(() => i18n.changeLanguage("id"));

function setCurrentUser(role: Role) {
  useStore.setState({
    user: makeUser({ id: "usr_current", email: "current@test.com", role }),
    isAuthenticated: true,
  });
}

function renderPage(id = "usr_4") {
  return render(
    <TestProviders initialEntries={[`/users/${id}`]} routePath="/users/:id">
      <UserDetail />
    </TestProviders>,
  );
}

async function openEdit() {
  fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
}

describe("UserDetail (D2)", () => {
  beforeEach(() => {
    setCurrentUser(Role.ADMIN);
  });

  it("renders a Joined detail row with the joined year", async () => {
    server.use(
      http.get("*/api/users/:id", () =>
        HttpResponse.json({
          code: 100200,
          message: "OK",
          data: makeUser({ id: "usr_4", name: "Jane Doe", joined_year: 2023 }),
        }),
      ),
    );
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Joined year").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2023").length).toBeGreaterThan(0);
  });

  it("shows an em dash for a null joined year", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Joined year").length).toBeGreaterThan(0);
  });

  it("renders a role select in edit mode for an admin current user", async () => {
    renderPage();
    await openEdit();
    expect(await screen.findByRole("combobox", { name: /role/i })).toBeInTheDocument();
  });

  it("does not offer an Edit button for an issuer current user", async () => {
    setCurrentUser(Role.ISSUER);
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it("changing the role sends PUT /users/batch/role and not /users/batch", async () => {
    let roleBody: unknown;
    let batchCalled = false;
    server.use(
      http.put("*/api/users/batch/role", async ({ request }) => {
        roleBody = await request.json();
        return HttpResponse.json({ code: 300500, message: "ok", data: null });
      }),
      http.put("*/api/users/batch", () => {
        batchCalled = true;
        return HttpResponse.json({ code: 300800, message: "ok", data: null });
      }),
    );
    renderPage();
    await openEdit();

    const roleSelect = await screen.findByRole("combobox", { name: /role/i });
    fireEvent.click(roleSelect);
    fireEvent.click(await screen.findByRole("option", { name: /issuer/i }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    fireEvent.click(await screen.findByRole("button", { name: /^change role$/i }));

    await waitFor(() => {
      expect(roleBody).toEqual({ user_roles: [{ user_id: "usr_4", role: "issuer" }] });
    });
    expect(batchCalled).toBe(false);
  });

  it("does not offer Super Admin in the role dropdown", async () => {
    renderPage();
    await openEdit();

    const roleSelect = await screen.findByRole("combobox", { name: /role/i });
    fireEvent.click(roleSelect);

    expect(await screen.findByRole("option", { name: /holder/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /issuer/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^admin$/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /super admin/i })).not.toBeInTheDocument();
  });

  it("hides the Edit button for the current user's own row (self, non-super-admin)", async () => {
    useStore.setState({
      user: makeUser({ id: "usr_4", email: "current@test.com", role: Role.ADMIN }),
      isAuthenticated: true,
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it("enters edit mode and saves the profile via PUT /users/batch", async () => {
    let requestBody: unknown;
    server.use(
      http.put("*/api/users/batch", async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ code: 300800, message: "ok", data: null });
      }),
    );
    renderPage();
    await openEdit();
    const nameInput = await screen.findByDisplayValue("Jane Doe");
    fireEvent.change(nameInput, { target: { value: "Jane Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(requestBody).toEqual({ users: [{ id: "usr_4", name: "Jane Updated" }] });
    });
  });

  it("a no-op Save sends no requests and closes edit mode", async () => {
    let batchCalled = false;
    let roleCalled = false;
    server.use(
      http.put("*/api/users/batch", () => {
        batchCalled = true;
        return HttpResponse.json({ code: 300800, message: "ok", data: null });
      }),
      http.put("*/api/users/batch/role", () => {
        roleCalled = true;
        return HttpResponse.json({ code: 300500, message: "ok", data: null });
      }),
    );
    renderPage();
    await openEdit();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument(),
    );
    expect(batchCalled).toBe(false);
    expect(roleCalled).toBe(false);
  });

  it("omits cleared unit_id/joined_year from the save payload (no null clear)", async () => {
    let requestBody: unknown;
    server.use(
      http.get("*/api/users/:id", () =>
        HttpResponse.json({
          code: 100200,
          message: "OK",
          data: makeUser({ id: "usr_4", name: "Jane Doe", unit_id: "unit_01", joined_year: 2023 }),
        }),
      ),
      http.put("*/api/users/batch", async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ code: 300800, message: "ok", data: null });
      }),
    );
    renderPage();
    await openEdit();

    const user = userEvent.setup();
    const unitTrigger = await screen.findByRole("button", { name: /^unit$/i });
    // ponytail: Radix DropdownMenu open is occasionally missed by the first
    // pointerdown under CPU load (jsdom + full-suite runs) — retry the click
    // until the menu is actually open instead of asserting after one attempt.
    await waitFor(async () => {
      await user.click(unitTrigger);
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    const notSet = await screen.findByRole("menuitem", { name: /not set/i });
    await user.click(notSet);

    const joinedYearInput = screen.getByLabelText("Joined year");
    fireEvent.change(joinedYearInput, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      const body = requestBody as { users?: Array<Record<string, unknown>> };
      expect(body.users).toBeDefined();
      const sent = body.users?.[0];
      expect(sent).not.toHaveProperty("unit_id");
      expect(sent).not.toHaveProperty("joined_year");
      expect(sent?.id).toBe("usr_4");
    });
  });

  it("renders the unit read value as its full hierarchical path", async () => {
    server.use(
      http.get("*/api/users/:id", () =>
        HttpResponse.json({
          code: 100200,
          message: "OK",
          data: makeUser({ id: "usr_4", name: "Jane Doe", unit_id: "unit_02" }),
        }),
      ),
    );
    renderPage();
    await waitFor(() =>
      expect(
        screen.getAllByText("Faculty of Engineering > Computer Science Department").length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders without crashing when the user-units endpoint omits the data key (empty table)", async () => {
    server.use(
      http.get("*/api/user-units", () =>
        HttpResponse.json({ code: 301000, message: "User units retrieved successfully." }),
      ),
    );
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));
    expect(screen.queryByText("Unit")).not.toBeNull();
  });

  it("edits email for a non-self target", async () => {
    let requestBody: unknown;
    server.use(
      http.put("*/api/users/batch", async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ code: 300800, message: "ok", data: null });
      }),
    );
    renderPage();
    await openEdit();

    const emailInput = await screen.findByDisplayValue("holder@credchain.demo");
    fireEvent.change(emailInput, { target: { value: "new@credchain.demo" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(requestBody).toEqual({ users: [{ id: "usr_4", email: "new@credchain.demo" }] });
    });
  });

  it("locks email and role for a Super Admin editing their own record", async () => {
    server.use(
      http.get("*/api/users/:id", () =>
        HttpResponse.json({
          code: 100200,
          message: "OK",
          data: makeUser({ id: "usr_1", role: Role.SUPER_ADMIN, name: "Super Admin" }),
        }),
      ),
    );
    useStore.setState({
      user: makeUser({ id: "usr_1", role: Role.SUPER_ADMIN, name: "Super Admin" }),
      isAuthenticated: true,
    });
    renderPage("usr_1");
    await openEdit();

    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /role/i })).not.toBeInTheDocument();
    expect(await screen.findAllByText(/use update email instead/i)).not.toHaveLength(0);
  });

  it("shows no Edit button and the trashed hint for a trashed target", async () => {
    renderPage("usr_5");
    await waitFor(() => expect(screen.getAllByText("Trashed User").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("Trashed User must be restored before editing."),
    ).toBeInTheDocument();
  });

  it("deletes a live target via DELETE /users/batch", async () => {
    let requestBody: unknown;
    server.use(
      http.delete("*/api/users/batch", async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ code: 300900, message: "ok", data: null });
      }),
    );
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /delete user/i }));

    await waitFor(() => {
      expect(requestBody).toEqual({ ids: ["usr_4"] });
    });
  });

  it("restores a trashed target via PUT /users/batch/restore", async () => {
    let requestBody: unknown;
    server.use(
      http.put("*/api/users/batch/restore", async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ code: 300700, message: "ok", data: null });
      }),
    );
    renderPage("usr_5");
    await waitFor(() => expect(screen.getAllByText("Trashed User").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /^restore$/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^restore$/i }));

    await waitFor(() => {
      expect(requestBody).toEqual({ ids: ["usr_5"] });
    });
  });
});
