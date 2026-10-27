import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { UserSelfProfile } from "./UserSelfProfile";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { mockUserWithMeta } from "@/test/fixtures";
import { i18n } from "@shared/i18n/config";

function renderProfile(initialEntries = ["/account/profile"]) {
  return render(<UserSelfProfile />, {
    wrapper: ({ children }) => (
      <TestProviders initialEntries={initialEntries}>{children}</TestProviders>
    ),
  });
}

describe("UserSelfProfile", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useStore.setState({ user: null, isAuthenticated: false });
  });

  it("renders profile identity and email without a phone form", () => {
    useStore.setState({
      user: mockUserWithMeta({ name: "Jane Doe", email: "jane@example.com" }),
      isAuthenticated: true,
    });
    renderProfile();
    expect(screen.getByText("My Profile")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Jane Doe" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /update email/i })).toHaveAttribute(
      "href",
      "/account/email",
    );
    expect(screen.getByRole("button", { name: /copy email/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="tel"]')).not.toBeInTheDocument();
  });

  it.each([Role.ADMIN, Role.ISSUER, Role.HOLDER])("keeps %s read-only", (role) => {
    useStore.setState({ user: mockUserWithMeta({ role }), isAuthenticated: true });
    renderProfile();
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).not.toBeInTheDocument();
  });

  it.each([Role.SUPER_ADMIN, Role.ADMIN, Role.ISSUER, Role.HOLDER])(
    "shows rich identity to %s, with hierarchy but no role identity field",
    async (role) => {
      useStore.setState({
        user: mockUserWithMeta({
          role,
          email: "jane@example.com",
          unit_id: "unit_02",
          joined_year: 2024,
        }),
        isAuthenticated: true,
      });
      renderProfile();
      expect(
        await screen.findByText("Faculty of Engineering > Computer Science Department"),
      ).toBeInTheDocument();
      expect(screen.getByText("2024")).toBeInTheDocument();
      expect(screen.getByText("Full name")).toBeInTheDocument();
      expect(screen.getByText("Number / ID")).toBeInTheDocument();
      expect(screen.getByText("Unit")).toBeInTheDocument();
      expect(screen.getByText("Joined year")).toBeInTheDocument();
      expect(screen.getByText("Birth date")).toBeInTheDocument();
      expect(screen.getByText("Gender")).toBeInTheDocument();
      expect(screen.getByText("Additional Information")).toBeInTheDocument();
      expect(screen.getAllByText("Email")).toHaveLength(1);
      expect(screen.getByRole("link", { name: /update email/i })).toHaveAttribute(
        "href",
        "/account/email",
      );
      expect(screen.queryByText("Role")).not.toBeInTheDocument();
    },
  );

  it("opens permitted fields after clicking Edit, without an identity email or role field", async () => {
    useStore.setState({
      user: mockUserWithMeta({ role: Role.SUPER_ADMIN, gender: "female" }),
      isAuthenticated: true,
    });
    renderProfile();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Full name" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(await screen.findByRole("textbox", { name: "Full name" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Number / ID" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unit" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Joined year" })).toBeInTheDocument();
    expect(screen.getByLabelText("Birth date")).toHaveAttribute("type", "date");
    expect(screen.getByRole("combobox", { name: "Gender" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add field/i })).toBeInTheDocument();
    expect(screen.getAllByText("Email")).toHaveLength(1);
    expect(screen.queryByText(/use update email instead/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /update email/i })).toHaveAttribute(
      "href",
      "/account/email",
    );
    expect(screen.queryByRole("textbox", { name: "Email" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /role/i })).not.toBeInTheDocument();
  });

  it("sends changed Unit and Joined year without email or role, and refreshes read view", async () => {
    const initial = mockUserWithMeta({
      role: Role.SUPER_ADMIN,
      unit_id: "unit_01",
      joined_year: 2023,
    });
    let body: unknown;
    server.use(
      http.put("*/api/users/batch", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          code: 300800,
          message: "ok",
          data: [{ ...initial, unit_id: "unit_02", joined_year: 2025 }],
        });
      }),
    );
    useStore.setState({ user: initial, isAuthenticated: true });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    await userEvent.click(screen.getByRole("button", { name: "Unit" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Computer Science Department" }),
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Joined year" }), {
      target: { value: "2025" },
    });
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(body).toEqual({ users: [{ id: initial.id, unit_id: "unit_02", joined_year: 2025 }] }),
    );
    await waitFor(() => expect(useStore.getState().user?.joined_year).toBe(2025));
    expect(
      await screen.findByText("Faculty of Engineering > Computer Science Department"),
    ).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
  });

  it("blocks clearing an existing Unit or Joined year", async () => {
    let calls = 0;
    server.use(
      http.put("*/api/users/batch", () => {
        calls++;
        return HttpResponse.json({ data: [] });
      }),
    );
    useStore.setState({
      user: mockUserWithMeta({ role: Role.SUPER_ADMIN, unit_id: "unit_01", joined_year: 2024 }),
      isAuthenticated: true,
    });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    await userEvent.click(screen.getByRole("button", { name: "Unit" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Not set" }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/this field cannot be cleared/i)).toBeInTheDocument();
    expect(calls).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Unit" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Faculty of Engineering" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Joined year" }), {
      target: { value: "" },
    });
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/this field cannot be cleared/i)).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("sets initially empty Unit and Joined year", async () => {
    const initial = mockUserWithMeta({ role: Role.SUPER_ADMIN, unit_id: null, joined_year: null });
    let body: unknown;
    server.use(
      http.put("*/api/users/batch", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: [{ ...initial, unit_id: "unit_01", joined_year: 2024 }] });
      }),
    );
    useStore.setState({ user: initial, isAuthenticated: true });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    await userEvent.click(screen.getByRole("button", { name: "Unit" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Faculty of Engineering" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Joined year" }), {
      target: { value: "2024" },
    });
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(body).toEqual({ users: [{ id: initial.id, unit_id: "unit_01", joined_year: 2024 }] }),
    );
  });

  it("rejects invalid Joined year before sending a request", async () => {
    let calls = 0;
    server.use(
      http.put("*/api/users/batch", () => {
        calls++;
        return HttpResponse.json({ data: [] });
      }),
    );
    useStore.setState({
      user: mockUserWithMeta({ role: Role.SUPER_ADMIN }),
      isAuthenticated: true,
    });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Joined year" }), {
      target: { value: "1899" },
    });
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(calls).toBe(0);
    expect(screen.getByRole("spinbutton", { name: "Joined year" })).toBeInTheDocument();
  });

  it("does not submit an unchanged profile", async () => {
    let calls = 0;
    server.use(
      http.put("*/api/users/batch", () => {
        calls++;
        return HttpResponse.json({ data: [] });
      }),
    );
    useStore.setState({
      user: mockUserWithMeta({ role: Role.SUPER_ADMIN }),
      isAuthenticated: true,
    });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument(),
    );
    expect(calls).toBe(0);
  });

  it("sends only changed allowlisted fields and refreshes navbar state", async () => {
    const initial = mockUserWithMeta({ role: Role.SUPER_ADMIN, name: "Original Name" });
    let body: unknown;
    server.use(
      http.put("*/api/users/batch", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          code: 100202,
          message: "ok",
          data: [{ ...initial, name: "Updated Name" }],
        });
      }),
    );
    useStore.setState({ user: initial, isAuthenticated: true });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    const name = await screen.findByRole("textbox", { name: "Full name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Updated Name");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(body).toEqual({ users: [{ id: initial.id, name: "Updated Name" }] }),
    );
    await waitFor(() => expect(useStore.getState().user?.name).toBe("Updated Name"));
    expect(screen.getByRole("heading", { level: 2, name: "Updated Name" })).toBeInTheDocument();
  });

  it("updates number, birth date, gender and metadata without protected fields", async () => {
    const initial = mockUserWithMeta({ role: Role.SUPER_ADMIN, gender: null });
    let body: unknown;
    server.use(
      http.put("*/api/users/batch", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          data: [
            {
              ...initial,
              number: "NEW-42",
              birth_date: "2001-01-01T00:00:00Z",
              gender: "female",
              meta: { department: "Research", level: "L3" },
            },
          ],
        });
      }),
    );
    useStore.setState({ user: initial, isAuthenticated: true });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    await userEvent.clear(await screen.findByRole("textbox", { name: "Number / ID" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Number / ID" }), "NEW-42");
    await userEvent.clear(screen.getByLabelText("Birth date"));
    await userEvent.type(screen.getByLabelText("Birth date"), "2001-01-01");
    fireEvent.click(screen.getByRole("combobox", { name: "Gender" }));
    fireEvent.click(await screen.findByRole("option", { name: "Female" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Meta value 1" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Meta value 1" }), "Research");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(body).toEqual({
        users: [
          {
            id: initial.id,
            number: "NEW-42",
            birth_date: "2001-01-01",
            gender: "female",
            meta: { department: "Research", level: "L3" },
          },
        ],
      }),
    );
  });

  it("persists an empty number to clear a number", async () => {
    const initial = mockUserWithMeta({ role: Role.SUPER_ADMIN });
    let body: unknown;
    server.use(
      http.put("*/api/users/batch", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: [{ ...initial, number: "" }] });
      }),
    );
    useStore.setState({ user: initial, isAuthenticated: true });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    await userEvent.clear(await screen.findByRole("textbox", { name: "Number / ID" }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(body).toEqual({ users: [{ id: initial.id, number: "" }] }));
  });

  it("persists an empty metadata object instead of a null clear", async () => {
    const initial = mockUserWithMeta({
      role: Role.SUPER_ADMIN,
      meta: { department: "Engineering" },
    });
    let body: unknown;
    server.use(
      http.put("*/api/users/batch", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: [{ ...initial, meta: {} }] });
      }),
    );
    useStore.setState({ user: initial, isAuthenticated: true });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Remove field 1" }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(body).toEqual({ users: [{ id: initial.id, meta: {} }] }));
  });

  it("cancels changes and keeps edit mode on an API error", async () => {
    const initial = mockUserWithMeta({ role: Role.SUPER_ADMIN });
    useStore.setState({ user: initial, isAuthenticated: true });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    const name = await screen.findByRole("textbox", { name: "Full name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Temporary");
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("textbox", { name: "Full name" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(screen.getByRole("textbox", { name: "Full name" })).toHaveValue(initial.name);

    server.use(
      http.put("*/api/users/batch", () =>
        HttpResponse.json({ code: 300844, message: "Forbidden" }, { status: 403 }),
      ),
    );
    await userEvent.clear(screen.getByRole("textbox", { name: "Full name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Full name" }), "Retry Name");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Full name" })).toHaveValue("Retry Name"),
    );
  });

  it("rejects clearing an existing birth date rather than reporting success", async () => {
    let calls = 0;
    server.use(
      http.put("*/api/users/batch", () => {
        calls++;
        return HttpResponse.json({ data: [] });
      }),
    );
    useStore.setState({
      user: mockUserWithMeta({ role: Role.SUPER_ADMIN }),
      isAuthenticated: true,
    });
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    const date = await screen.findByLabelText("Birth date");
    await userEvent.clear(date);
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/this field cannot be cleared/i)).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("renders Indonesian copy", async () => {
    await i18n.changeLanguage("id");
    useStore.setState({ user: mockUserWithMeta({}), isAuthenticated: true });
    renderProfile();
    expect(screen.getByText("Profil Saya")).toBeInTheDocument();
  });
});
