import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { NavbarOverview } from "./NavbarOverview";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { mockUserWithMeta } from "@/test/fixtures";
import { i18n } from "@shared/i18n/config";

const mockMutate = vi.fn();
vi.mock("@feature/auth/api/useLogout", () => ({
  useLogout: () => ({ mutate: mockMutate, isPending: false }),
}));

function renderNavbar() {
  return render(<NavbarOverview onMenuClick={() => {}} />, { wrapper: TestProviders });
}

describe("NavbarOverview logout confirmation", () => {
  beforeEach(() => {
    void i18n.changeLanguage("en");
    mockMutate.mockClear();
    useStore.setState({
      user: mockUserWithMeta({ role: Role.ADMIN }),
      isAuthenticated: true,
    });
  });

  it("shows confirm dialog from user menu logout", async () => {
    renderNavbar();
    await userEvent.click(screen.getByRole("button", { name: /user menu/i }));
    await userEvent.click(await screen.findByText(/log out/i));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

describe("NavbarOverview profile menu", () => {
  it.each([Role.SUPER_ADMIN, Role.ADMIN, Role.ISSUER, Role.HOLDER])(
    "links %s to Profile without a separate Edit Profile item",
    async (role) => {
      useStore.setState({ user: mockUserWithMeta({ role }), isAuthenticated: true });
      renderNavbar();
      await userEvent.click(screen.getByRole("button", { name: /user menu/i }));
      expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
        "href",
        "/account/profile",
      );
      expect(screen.getByRole("menuitem", { name: "Update Email" })).toHaveAttribute(
        "href",
        "/account/email",
      );
      expect(screen.queryByRole("menuitem", { name: "Edit Profile" })).not.toBeInTheDocument();
    },
  );
});

describe("NavbarOverview search", () => {
  beforeEach(() => {
    void i18n.changeLanguage("en");
    useStore.setState({
      user: mockUserWithMeta({ role: Role.ADMIN }),
      isAuthenticated: true,
    });
  });

  it("shows dropdown results when typing a matching query", async () => {
    renderNavbar();
    const input = screen.getByRole("searchbox");
    await userEvent.type(input, "user");
    expect(await screen.findByText("Users")).toBeInTheDocument();
  });

  it("shows no dropdown when query is empty", async () => {
    renderNavbar();
    const input = screen.getByRole("searchbox");
    await userEvent.clear(input);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("clears query on Escape", async () => {
    renderNavbar();
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await userEvent.type(input, "user");
    await userEvent.keyboard("{Escape}");
    expect(input.value).toBe("");
  });
});

describe("NavbarOverview notifications bell", () => {
  beforeEach(() => {
    void i18n.changeLanguage("en");
    useStore.setState({
      user: mockUserWithMeta({ id: "usr_bell", role: Role.HOLDER }),
      isAuthenticated: true,
    });
  });

  it.each([Role.HOLDER, Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN])(
    "renders bell button with link to /notifications for role %s",
    async (role) => {
      useStore.setState({
        user: mockUserWithMeta({ id: "usr_role", role }),
        isAuthenticated: true,
      });
      renderNavbar();
      const link = await screen.findByRole("link", { name: /notifications/i });
      expect(link).toHaveAttribute("href", "/notifications");
    },
  );

  it("shows unread badge with exact count in aria-label when count > 0", async () => {
    server.use(
      http.get("*/api/notifications/unread-count", () => {
        return HttpResponse.json({
          code: 400100,
          message: "OK",
          data: { unread_count: 5 },
        });
      }),
    );

    renderNavbar();
    const bellLink = await screen.findByRole("link", { name: /5 unread notifications/i });
    expect(bellLink).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 99+ visually but exact count in accessible label when count > 99", async () => {
    server.use(
      http.get("*/api/notifications/unread-count", () => {
        return HttpResponse.json({
          code: 400100,
          message: "OK",
          data: { unread_count: 142 },
        });
      }),
    );

    renderNavbar();
    const bellLink = await screen.findByRole("link", { name: /142 unread notifications/i });
    expect(bellLink).toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("hides badge when unread count is 0", async () => {
    server.use(
      http.get("*/api/notifications/unread-count", () => {
        return HttpResponse.json({
          code: 400100,
          message: "OK",
          data: { unread_count: 0 },
        });
      }),
    );

    renderNavbar();
    const bellLink = await screen.findByRole("link", { name: /^notifications$/i });
    expect(bellLink).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("does not show zero badge on query failure", async () => {
    server.use(
      http.get("*/api/notifications/unread-count", () => {
        return HttpResponse.json({ code: 500, message: "Error" }, { status: 500 });
      }),
    );

    renderNavbar();
    const bellLink = await screen.findByRole("link", { name: /^notifications$/i });
    expect(bellLink).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

