import { beforeEach, describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

function renderPage() {
  return render(
    <TestProviders initialEntries={["/users/usr_4"]} routePath="/users/:id">
      <UserDetail />
    </TestProviders>,
  );
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

  it("renders a role dropdown for an admin current user", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
  });

  it("does not render a role dropdown for an issuer current user", async () => {
    setCurrentUser(Role.ISSUER);
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("changing the role sends PUT /users/batch/role", async () => {
    let requestBody: unknown;
    server.use(
      http.put("*/api/users/batch/role", async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ code: 300500, message: "ok", data: null });
      }),
    );
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));

    const combos = screen.getAllByRole("combobox");
    fireEvent.click(combos[0]);
    const option = await screen.findByRole("option", { name: /issuer/i });
    fireEvent.click(option);

    await waitFor(() => {
      expect(requestBody).toEqual({ user_roles: [{ user_id: "usr_4", role: "issuer" }] });
    });
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
    await waitFor(() => expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const nameInput = await screen.findByDisplayValue("Jane Doe");
    fireEvent.change(nameInput, { target: { value: "Jane Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(requestBody).toEqual({ users: [{ id: "usr_4", name: "Jane Updated" }] });
    });
  });
});
