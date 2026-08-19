import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { makeUser } from "@/test/fixtures";
import { Role } from "@shared/auth/role";
import type { UserDTO } from "@shared/types/api";
import { UserContactBlock } from "./UserContactBlock";

describe("UserContactBlock", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders name, role badge, and contact details for full labelType", () => {
    const user = {
      ...makeUser({ id: "usr_1", name: "Alice", number: "EMP-001", role: Role.HOLDER }),
      phone_number: "+6281234567890",
    } as UserDTO & { phone_number?: string | null };
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/holder/i)).toBeInTheDocument();
    expect(screen.getByText("EMP-001")).toBeInTheDocument();
    expect(screen.getByText("test@credchain.demo")).toBeInTheDocument();
    expect(screen.getByText("+6281234567890")).toBeInTheDocument();
  });

  it("does not render active status badge", () => {
    const user = makeUser({ deleted_at: null });
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.queryByText("Trashed")).not.toBeInTheDocument();
  });

  it("renders trashed status badge when user is deleted", () => {
    const user = makeUser({ name: "Bob", deleted_at: "2026-01-01T00:00:00Z" });
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.getByText("Trashed")).toBeInTheDocument();
  });

  it("renders wallet address truncated in full mode", () => {
    const user = makeUser({ wallet_address: "0x" + "a".repeat(40) });
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.getByTitle("0x" + "a".repeat(40))).toBeInTheDocument();
  });

  it("renders gender when present in full mode", () => {
    const user = makeUser({ gender: "female" });
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.getByText("Female")).toBeInTheDocument();
  });

  it("does not render gender when absent", () => {
    const user = makeUser({ gender: null });
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.queryByText("Female")).not.toBeInTheDocument();
    expect(screen.queryByText("Male")).not.toBeInTheDocument();
  });

  it("renders compact mode with name and role only, no contact details", () => {
    const user = makeUser({ name: "Eve", role: Role.ADMIN });
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="issuer" labelType="compact" />,
      { wrapper: TestProviders },
    );

    expect(screen.getByText("Eve")).toBeInTheDocument();
    expect(screen.getByText(/admin/i)).toBeInTheDocument();
    expect(screen.queryByText("test@credchain.demo")).not.toBeInTheDocument();
  });

  it("uses fallbackId as name when user is undefined", () => {
    render(
      <UserContactBlock
        user={undefined}
        fallbackId="usr_fallback"
        copyPrefix="holder"
        labelType="full"
      />,
      { wrapper: TestProviders },
    );

    expect(screen.getByText("usr_fallback")).toBeInTheDocument();
  });

  it("uses user.email as name when name is null", () => {
    const user = makeUser({ name: null, email: "noname@test.com" });
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.getAllByText("noname@test.com").length).toBeGreaterThanOrEqual(1);
  });

  it("renders copy buttons with correct holder aria labels", () => {
    const user = {
      ...makeUser({ number: "NUM-1" }),
      phone_number: "+6281234567890",
    } as UserDTO & { phone_number?: string | null };
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.getByRole("button", { name: "Copy holder number" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy holder email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy holder phone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy holder wallet" })).toBeInTheDocument();
  });

  it("renders copy buttons with user prefix when copyPrefix is user", () => {
    const user = makeUser({ number: "NUM-1" });
    render(<UserContactBlock user={user} fallbackId="usr_1" copyPrefix="user" labelType="full" />, {
      wrapper: TestProviders,
    });

    expect(screen.getByRole("button", { name: "Copy user number" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy user email" })).toBeInTheDocument();
  });

  it("applies line-clamp-2 to the name element", () => {
    const user = makeUser({ name: "Alice" });
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    const nameEl = screen.getByText("Alice");
    expect(nameEl.className).toContain("line-clamp-2");
  });

  it("applies error tone styles when tone is error", () => {
    const user = makeUser({ name: "Charlie", role: Role.HOLDER });
    render(
      <UserContactBlock
        user={user}
        fallbackId="usr_1"
        copyPrefix="revoker"
        labelType="compact"
        tone="error"
      />,
      { wrapper: TestProviders },
    );

    const nameEl = screen.getByText("Charlie");
    expect(nameEl.className).toContain("text-error");
  });

  it("renders name as a link to user detail when blockLinks is false", () => {
    const user = makeUser({ id: "usr_link", name: "Linkable" });
    render(
      <UserContactBlock user={user} fallbackId="usr_link" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    const link = screen.getByRole("link", { name: "Linkable" });
    expect(link).toHaveAttribute("href", "/users/usr_link");
  });

  it("renders name as plain span when blockLinks is true", () => {
    const user = makeUser({ name: "Static" });
    render(
      <UserContactBlock
        user={user}
        fallbackId="usr_1"
        copyPrefix="holder"
        labelType="full"
        blockLinks
      />,
      { wrapper: TestProviders },
    );

    expect(screen.getByText("Static").tagName).toBe("SPAN");
    expect(screen.queryByRole("link", { name: "Static" })).not.toBeInTheDocument();
  });

  it("does not render phone number row when phone_number is null", () => {
    const user = makeUser({});
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.queryByRole("button", { name: /copy holder phone/i })).not.toBeInTheDocument();
  });

  it("does not render wallet row when wallet_address is not provided or empty", () => {
    const user = makeUser({ wallet_address: "" });
    render(
      <UserContactBlock user={user} fallbackId="usr_1" copyPrefix="holder" labelType="full" />,
      { wrapper: TestProviders },
    );

    expect(screen.queryByRole("button", { name: /copy holder wallet/i })).not.toBeInTheDocument();
  });
});
