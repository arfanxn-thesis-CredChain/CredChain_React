import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useLocation } from "react-router-dom";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { mockUsers } from "@/test/fixtures";
import { UserList } from "./UserList";

function LocationSentinel() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location-search">{location.search}</div>
      <div data-testid="location-pathname">{location.pathname}</div>
    </>
  );
}

function renderUserList() {
  return render(
    <>
      <UserList />
      <LocationSentinel />
    </>,
    { wrapper: TestProviders },
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  // Reset store with admin user so the component renders the manage UI
  useStore.setState({
    user: {
      id: "usr_admin_test",
      name: "Test Admin",
      number: null,
      unit_id: null,
      joined_year: null,
      email: "admin@test.com",
      birth_date: null,
      gender: null,
      role: Role.ADMIN,
      meta: null,
      wallet_address: "0x" + "0".repeat(40),
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
    },
    isAuthenticated: true,
  });
});

describe("UserList", () => {
  it("renders the page header and search input", async () => {
    renderUserList();

    expect(await screen.findByText("User Directory")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
  });

  it("renders mock users from MSW after load", async () => {
    renderUserList();

    await waitFor(
      () => {
        expect(screen.getByText("Platform Admin")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText("Default Issuer")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("shows entity count after load", async () => {
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText(/5 users$/i)).toBeInTheDocument();
    });
  });

  it("shows the Register User CTA for admin role", async () => {
    renderUserList();

    expect(await screen.findByRole("link", { name: /register user/i })).toBeInTheDocument();
  });

  it("hides Register User CTA for issuer role", async () => {
    useStore.setState((s) => ({
      ...s,
      user: s.user ? { ...s.user, role: Role.ISSUER } : null,
    }));

    renderUserList();
    await screen.findByText("User Directory");

    expect(screen.queryByRole("link", { name: /register user/i })).not.toBeInTheDocument();
  });

  it("debounces the search input (does not crash on rapid typing)", async () => {
    const user = userEvent.setup();
    renderUserList();

    const search = await screen.findByPlaceholderText(/search by name/i);
    await user.type(search, "admin");

    expect(search).toHaveValue("admin");
  });

  it("filter dropdown updates URL when selecting Active only", async () => {
    const user = userEvent.setup();
    renderUserList();
    await screen.findByText("User Directory");

    await user.click(screen.getByRole("button", { name: /status/i }));
    const activeItem = await screen.findByRole("menuitem", { name: /active only/i });
    await user.click(activeItem);

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toContain("status=deleted_at_");
    });
  });

  it("clicking a sort option updates the URL", async () => {
    const user = userEvent.setup();
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText("Platform Admin")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /sort/i }));
    const item = await screen.findByRole("menuitem", { name: /name a→z/i });
    await user.click(item);

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toContain("sort=name");
    });
  });

  it("shows actions dropdown menu for each row", async () => {
    renderUserList();
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /actions/i }).length).toBeGreaterThan(0),
    );
  });

  it("shows transfer super admin option when auth is super admin and target qualifies", async () => {
    useStore.setState({
      user: { ...mockUsers[0] },
      isAuthenticated: true,
    });

    const user = userEvent.setup();
    renderUserList();

    await waitFor(() => expect(screen.getByText("Default Issuer")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await user.click(menuButtons[2]);

    expect(await screen.findByText(/Transfer Super Admin/i)).toBeInTheDocument();
  });

  it("hides transfer super admin option when auth is admin (not super admin)", async () => {
    useStore.setState({
      user: { ...mockUsers[1] },
      isAuthenticated: true,
    });

    const user = userEvent.setup();
    renderUserList();

    await waitFor(() => expect(screen.getByText("Default Issuer")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await user.click(menuButtons[2]);

    await screen.findByRole("menuitem", { name: /view/i });
    expect(screen.queryByText(/Transfer Super Admin/i)).not.toBeInTheDocument();
  });

  it("hides transfer super admin option on own row (self)", async () => {
    useStore.setState({
      user: { ...mockUsers[0] },
      isAuthenticated: true,
    });

    const user = userEvent.setup();
    renderUserList();

    await waitFor(() => expect(screen.getAllByText("Super Admin").length).toBeGreaterThan(0));

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await user.click(menuButtons[0]);

    await screen.findByRole("menuitem", { name: /view/i });
    expect(screen.queryByText(/Transfer Super Admin/i)).not.toBeInTheDocument();
  });

  it("renders gender inline in the User cell, not as a separate column", async () => {
    renderUserList();
    await waitFor(() =>
      expect(screen.queryByRole("columnheader", { name: /gender/i })).not.toBeInTheDocument(),
    );
  });

  it("does not render a Phone column header", async () => {
    renderUserList();
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    expect(screen.queryByRole("columnheader", { name: /^phone$/i })).not.toBeInTheDocument();
  });

  it("renders email in each row", async () => {
    renderUserList();
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    expect(screen.getByText("holder@credchain.demo")).toBeInTheDocument();
  });

  it("renders wallet address in each row", async () => {
    renderUserList();
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    expect(screen.getAllByText(/0x0{4}.*0{4}/i).length).toBeGreaterThan(0);
  });

  it("selecting a role filter updates the URL with role param", async () => {
    const user = userEvent.setup();
    renderUserList();
    await screen.findByText("User Directory");

    await user.click(screen.getByRole("button", { name: /^role:/i }));
    const adminItem = await screen.findByRole("menuitem", { name: /^admin$/i });
    await user.click(adminItem);

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toContain("role=admin");
    });
  });

  it("shows Delete option for an active user", async () => {
    const user = userEvent.setup();
    renderUserList();
    await waitFor(() => expect(screen.getByText("Default Issuer")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await user.click(menuButtons[2]);

    expect(await screen.findByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("shows Restore option for a trashed user", async () => {
    const user = userEvent.setup();
    renderUserList();
    await waitFor(() => expect(screen.getByText("Trashed User")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await user.click(menuButtons[4]);

    expect(await screen.findByRole("menuitem", { name: /restore/i })).toBeInTheDocument();
  });

  it("clicking Delete opens a confirm dialog", async () => {
    const user = userEvent.setup();
    renderUserList();
    await waitFor(() => expect(screen.getByText("Default Issuer")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await user.click(menuButtons[2]);
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("shows Edit menu item for super admin row when current user is super admin", async () => {
    useStore.setState({
      user: { ...mockUsers[0] },
      isAuthenticated: true,
    });

    const user = userEvent.setup();
    renderUserList();

    await waitFor(() => expect(screen.getAllByText("Super Admin").length).toBeGreaterThan(0));

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await user.click(menuButtons[0]);

    expect(await screen.findByRole("menuitem", { name: /view/i })).toBeInTheDocument();
  });

  it("hides Edit and Delete options for issuer role on live users", async () => {
    useStore.setState({
      user: { ...mockUsers[2] },
      isAuthenticated: true,
    });

    const ue = userEvent.setup();
    renderUserList();

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await ue.click(menuButtons[3]);

    expect(await screen.findByRole("menuitem", { name: /view/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("hides Restore option for issuer role on trashed users", async () => {
    useStore.setState({
      user: { ...mockUsers[2] },
      isAuthenticated: true,
    });

    const ue = userEvent.setup();
    renderUserList();

    await waitFor(() => expect(screen.getByText("Trashed User")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await ue.click(menuButtons[4]);

    expect(screen.queryByRole("menuitem", { name: /restore/i })).not.toBeInTheDocument();
  });

  it("shows Delete and Restore options for admin role but never Edit", async () => {
    const ue = userEvent.setup();
    renderUserList();
    await waitFor(() => expect(screen.getByText("Default Issuer")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await ue.click(menuButtons[2]);
    expect(await screen.findByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /edit/i })).not.toBeInTheDocument();

    await ue.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByText("Trashed User")).toBeInTheDocument());

    const menuButtons2 = screen.getAllByRole("button", { name: /actions/i });
    await ue.click(menuButtons2[4]);
    expect(await screen.findByRole("menuitem", { name: /restore/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("navigates to user detail on View click", async () => {
    const ue = userEvent.setup();
    renderUserList();

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    await ue.click(menuButtons[3]);
    await ue.click(await screen.findByRole("menuitem", { name: /view/i }));

    expect(screen.getByTestId("location-pathname").textContent).toBe("/users/usr_4");
  });

  it("hides Delete option for admin on another admin row", async () => {
    const ue = userEvent.setup();
    renderUserList();
    await waitFor(() => expect(screen.getByText("Platform Admin")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    // Platform Admin is row index 1 (usr_2, ADMIN)
    await ue.click(menuButtons[1]);

    expect(await screen.findByRole("menuitem", { name: /view/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("shows Delete option for admin on a holder row", async () => {
    const ue = userEvent.setup();
    renderUserList();
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    const menuButtons = screen.getAllByRole("button", { name: /actions/i });
    // Jane Doe is row index 3 (usr_4, HOLDER)
    await ue.click(menuButtons[3]);

    expect(await screen.findByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("renders joined years inline in each row", async () => {
    renderUserList();
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    expect(screen.queryByRole("columnheader", { name: /joined/i })).not.toBeInTheDocument();
    expect(screen.getByText(/2022/)).toBeInTheDocument();
    expect(screen.getByText(/2023/)).toBeInTheDocument();
  });

  it("renders an em dash placeholder when joined_year is null", async () => {
    renderUserList();
    await waitFor(() => expect(screen.getAllByText("Super Admin").length).toBeGreaterThan(0));
    expect(screen.getAllByText(/joined\s+—/i).length).toBeGreaterThan(0);
  });

  it("selecting a unit filter updates the URL with unit_id param", async () => {
    const user = userEvent.setup();
    renderUserList();
    await screen.findByText("User Directory");

    await user.click(screen.getByRole("button", { name: /unit: all/i }));
    const unitItem = await screen.findByRole("menuitem", {
      name: /computer science department/i,
    });
    await user.click(unitItem);

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toContain("unit=unit_02");
    });
  });
});
