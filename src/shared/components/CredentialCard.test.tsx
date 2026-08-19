import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { CredentialCard } from "./CredentialCard";
import { makeCredential, makeUser } from "@/test/fixtures";
import { Role } from "@shared/auth/role";
import type { UserDTO } from "@shared/types/api";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("CredentialCard", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    navigateMock.mockClear();
  });

  it("renders credential identity and holder/issuer info", () => {
    const credential = makeCredential({
      holder: {
        ...makeUser({ id: "usr_test_1", role: Role.HOLDER, name: "Test Holder" }),
        phone_number: "+6281234567890",
      } as UserDTO & { phone_number?: string | null },
    });
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText("Test Credential")).toBeInTheDocument();
    expect(screen.getByText(/cred_test_1/)).toBeInTheDocument();
    expect(screen.getByText("Test Holder")).toBeInTheDocument();
    expect(screen.getByText("test@credchain.demo")).toBeInTheDocument();
    expect(screen.getByText("+6281234567890")).toBeInTheDocument();
    expect(screen.getByText("Test Issuer")).toBeInTheDocument();
  });

  it("renders credential id truncated as 10 first + 4 last characters", () => {
    const credential = makeCredential({ id: "01J8K2M3N4P5Q6R7S8T9U0V1W" });
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText("01J8K2M3N4...0V1W")).toBeInTheDocument();
    expect(screen.getByTitle("01J8K2M3N4P5Q6R7S8T9U0V1W")).toBeInTheDocument();
  });

  it("navigates to credential detail when card body is clicked", async () => {
    const user = userEvent.setup();
    const credential = makeCredential();
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    await user.click(screen.getByText("Test Credential"));
    expect(navigateMock).toHaveBeenCalledWith("/credentials/cred_test_1");
  });

  it("links holder name to user detail", () => {
    const credential = makeCredential();
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    const link = screen.getByRole("link", { name: /test holder/i });
    expect(link).toHaveAttribute("href", "/users/usr_test_1");
  });

  it("does not navigate to credential detail when clicking copy button", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const credential = makeCredential();
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: /copy credential id/i }));
    expect(writeTextMock).toHaveBeenCalledWith("cred_test_1");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows checkbox only for eligible credentials in revoke mode", () => {
    const activeCredential = makeCredential();
    const revokedCredential = makeCredential({
      id: "cred_revoked",
      revoked_at: "2026-06-01T00:00:00Z",
    });

    const { rerender } = render(
      <CredentialCard credential={activeCredential} selectionMode="revoke" />,
      { wrapper: TestProviders },
    );
    expect(screen.getByRole("button", { name: /select credential/i })).toBeInTheDocument();

    rerender(<CredentialCard credential={revokedCredential} selectionMode="revoke" />);
    expect(screen.getByRole("button", { name: /select credential/i })).toBeDisabled();
  });

  it("shows checkbox only for eligible credentials in re-extract mode", () => {
    const failedCredential = makeCredential({
      id: "cred_failed",
      extract_status: "failed",
    });
    const succeededCredential = makeCredential({
      id: "cred_succeeded",
      extract_status: "succeeded",
    });

    const { rerender } = render(
      <CredentialCard credential={failedCredential} selectionMode="reextract" />,
      { wrapper: TestProviders },
    );
    expect(screen.getByRole("button", { name: /select credential/i })).toBeInTheDocument();

    rerender(<CredentialCard credential={succeededCredential} selectionMode="reextract" />);
    expect(screen.getByRole("button", { name: /select credential/i })).toBeDisabled();
  });

  it("calls onSelect when checkbox is clicked", async () => {
    const user = userEvent.setup();
    const credential = makeCredential();
    const onSelect = vi.fn();

    render(<CredentialCard credential={credential} selectionMode="revoke" onSelect={onSelect} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByRole("button", { name: /select credential/i }));
    expect(onSelect).toHaveBeenCalled();
  });

  it("renders revoker and revoked date for revoked credentials", () => {
    const credential = makeCredential({
      id: "cred_revoked",
      revoked_at: "2026-06-01T00:00:00Z",
      revoker: makeUser({ id: "usr_revoker", role: Role.ISSUER, name: "Revoker User" }),
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(screen.getByText("Revoker User")).toBeInTheDocument();
  });

  it("renders extraction failed pill when extraction failed", () => {
    const credential = makeCredential({
      id: "cred_failed",
      extract_status: "failed",
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows deleted indicator for deleted holder", () => {
    const credential = makeCredential({
      holder: makeUser({
        id: "usr_deleted",
        role: Role.HOLDER,
        name: "Deleted User",
        deleted_at: "2026-05-01T00:00:00Z",
      }),
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText("Trashed")).toBeInTheDocument();
  });

  it("stacks holder name and role label vertically", () => {
    const credential = makeCredential({
      holder: makeUser({ id: "usr_anna", role: Role.HOLDER, name: "Anna Sorokin" }),
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    const holderLink = screen.getByRole("link", { name: /anna sorokin/i });
    expect(holderLink.textContent).toBe("Anna Sorokin");
    expect(screen.getByText(/holder/i)).toBeInTheDocument();
  });

  it("stacks compact issuer name and role label vertically", () => {
    const credential = makeCredential({
      issuer: makeUser({ id: "usr_super", role: Role.SUPER_ADMIN, name: "Super User" }),
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    const issuerLink = screen.getByRole("link", { name: /super user/i });
    expect(issuerLink.textContent).toBe("Super User");
    expect(screen.getByText(/super admin/i)).toBeInTheDocument();
  });

  it("translates super_admin role label instead of showing the i18n key", () => {
    const credential = makeCredential({
      issuer: makeUser({
        id: "usr_super",
        role: Role.SUPER_ADMIN,
        name: "Super User",
      }),
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.queryByText(/user\.edit\.role\.super_admin/)).not.toBeInTheDocument();
    expect(screen.getByText(/super admin/i)).toBeInTheDocument();
  });

  it("toggles selection instead of navigating when card is clicked in revoke mode", async () => {
    const user = userEvent.setup();
    const credential = makeCredential();
    const onSelect = vi.fn();

    render(<CredentialCard credential={credential} selectionMode="revoke" onSelect={onSelect} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByText("Test Credential"));
    expect(onSelect).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("toggles selection instead of navigating when card is clicked in re-extract mode", async () => {
    const user = userEvent.setup();
    const credential = makeCredential({ extract_status: "failed" });
    const onSelect = vi.fn();

    render(
      <CredentialCard credential={credential} selectionMode="reextract" onSelect={onSelect} />,
      { wrapper: TestProviders },
    );

    await user.click(screen.getByText("Test Credential"));
    expect(onSelect).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not navigate when clicking an ineligible card in selection mode", async () => {
    const user = userEvent.setup();
    const credential = makeCredential({ revoked_at: "2026-06-01T00:00:00Z" });

    render(<CredentialCard credential={credential} selectionMode="revoke" />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByText("Test Credential"));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows not-allowed cursor when selectDisabled is true", () => {
    const credential = makeCredential();
    render(<CredentialCard credential={credential} selectionMode="revoke" selectDisabled />, {
      wrapper: TestProviders,
    });

    const card = screen.getByRole("link", { name: /active/i });
    expect(card.className).toContain("cursor-not-allowed");
  });

  it("disables checkbox when selectDisabled is true", () => {
    const credential = makeCredential();
    render(<CredentialCard credential={credential} selectionMode="revoke" selectDisabled />, {
      wrapper: TestProviders,
    });

    expect(screen.getByRole("button", { name: /select credential/i })).toBeDisabled();
  });

  it("does not call onSelect when selectDisabled is true and card is clicked", async () => {
    const user = userEvent.setup();
    const credential = makeCredential();
    const onSelect = vi.fn();

    render(
      <CredentialCard
        credential={credential}
        selectionMode="revoke"
        onSelect={onSelect}
        selectDisabled
      />,
      { wrapper: TestProviders },
    );

    await user.click(screen.getByText("Test Credential"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
