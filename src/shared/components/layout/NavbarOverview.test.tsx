import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
