import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/test/TestProviders";
import { UserSelfProfile } from "./UserSelfProfile";
import { useStore } from "@app/store";
import { mockUserWithMeta } from "@/test/fixtures";
import { i18n } from "@shared/i18n/config";

describe("UserSelfProfile", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  it("renders title, description and avatar", async () => {
    useStore.setState({
      user: mockUserWithMeta({ name: "Jane Doe", email: "jane@example.com" }),
      isAuthenticated: true,
    });
    render(<UserSelfProfile />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getByText("My Profile")).toBeInTheDocument();
    });
    expect(screen.getByText("Your personal information.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Jane Doe" })).toBeInTheDocument();
  });

  it("displays birth date as formatted text, not as an input", async () => {
    useStore.setState({
      user: mockUserWithMeta({ birth_date: "2003-07-21T00:00:00Z" }),
      isAuthenticated: true,
    });
    render(<UserSelfProfile />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getByText(/july 21, 2003|21 july 2003/i)).toBeInTheDocument();
    });
    expect(document.querySelector('input[type="date"]')).not.toBeInTheDocument();
  });

  it("shows 'Not set' for empty birth date and number", async () => {
    useStore.setState({
      user: mockUserWithMeta({ birth_date: null, number: null }),
      isAuthenticated: true,
    });
    render(<UserSelfProfile />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getAllByText(/not set/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("phone number is the only editable input", async () => {
    useStore.setState({
      user: mockUserWithMeta({}),
      isAuthenticated: true,
    });
    render(<UserSelfProfile />, { wrapper: TestProviders });

    await waitFor(() => {
      const inputs = document.querySelectorAll("input");
      // exactly one editable input — phone
      expect(inputs.length).toBe(1);
      expect(inputs[0].getAttribute("type")).toBe("tel");
    });
  });

  it("save button is disabled when phone is unchanged", async () => {
    useStore.setState({
      user: mockUserWithMeta({}),
      isAuthenticated: true,
    });
    render(<UserSelfProfile />, { wrapper: TestProviders });

    await waitFor(() => {
      const saveBtn = screen.getByRole("button", { name: /save changes/i });
      expect(saveBtn).toBeDisabled();
    });
  });

  it("Update Email link points to /account/email", async () => {
    useStore.setState({
      user: mockUserWithMeta({ email: "user@example.com" }),
      isAuthenticated: true,
    });
    render(<UserSelfProfile />, { wrapper: TestProviders });

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /update email/i });
      expect(link).toHaveAttribute("href", "/account/email");
    });
  });

  it("renders copy email button on the profile card", async () => {
    useStore.setState({
      user: mockUserWithMeta({ email: "user@example.com" }),
      isAuthenticated: true,
    });
    render(<UserSelfProfile />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy email/i })).toBeInTheDocument();
    });
  });

  it("renders Indonesian copy when locale is id", async () => {
    await i18n.changeLanguage("id");
    useStore.setState({
      user: mockUserWithMeta({}),
      isAuthenticated: true,
    });
    render(<UserSelfProfile />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getByText("Profil Saya")).toBeInTheDocument();
    });
  });

  it("shows translated phone error (not raw key) on invalid phone", async () => {
    useStore.setState({
      user: mockUserWithMeta({}),
      isAuthenticated: true,
    });
    render(<UserSelfProfile />, { wrapper: TestProviders });

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { hidden: true }) ??
          document.querySelector('input[type="tel"]'),
      ).toBeInTheDocument(),
    );

    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, "08123");
    await userEvent.tab();

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("Use international format, e.g. +6281234567890");
      expect(screen.queryByText("zod.user.phoneFormat")).not.toBeInTheDocument();
    });
  });
});
