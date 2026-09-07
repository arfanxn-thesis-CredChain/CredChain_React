import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { CredentialCard } from "./CredentialCard";
import { makeCredential, makeUser } from "@/test/fixtures";
import { Role } from "@shared/auth/role";

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

  it("renders credential identity and holder info", () => {
    const credential = makeCredential({
      holder: makeUser({
        id: "usr_test_1",
        role: Role.HOLDER,
        name: "Test Holder",
        number: "22090001",
      }),
    });
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText("Test Credential")).toBeInTheDocument();
    expect(screen.getByText("Test Holder")).toBeInTheDocument();
    expect(screen.getByText("22090001")).toBeInTheDocument();
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

  it("shows checkbox only for eligible credentials in revoke mode", () => {
    const activeCredential = makeCredential({ status: "approved" });
    const revokedCredential = makeCredential({
      id: "cred_revoked",
      status: "revoked",
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
      extract_state: "failed",
    });
    const succeededCredential = makeCredential({
      id: "cred_succeeded",
      extract_state: "succeeded",
    });

    const { rerender } = render(
      <CredentialCard credential={failedCredential} selectionMode="reextract" />,
      { wrapper: TestProviders },
    );
    expect(screen.getByRole("button", { name: /select credential/i })).toBeInTheDocument();

    rerender(<CredentialCard credential={succeededCredential} selectionMode="reextract" />);
    expect(screen.getByRole("button", { name: /select credential/i })).toBeDisabled();
  });

  it("shows checkbox only for pending credentials in approve mode", () => {
    const pendingCredential = makeCredential({
      id: "cred_pending",
      status: "pending",
      approved_at: null,
      rejected_at: null,
    });
    const approvedCredential = makeCredential({ id: "cred_approved" });

    const { rerender } = render(
      <CredentialCard credential={pendingCredential} selectionMode="approve" />,
      { wrapper: TestProviders },
    );
    expect(screen.getByRole("button", { name: /select credential/i })).toBeEnabled();

    rerender(<CredentialCard credential={approvedCredential} selectionMode="approve" />);
    expect(screen.getByRole("button", { name: /select credential/i })).toBeDisabled();
  });

  it("shows checkbox only for pending credentials in reject mode", () => {
    const pendingCredential = makeCredential({
      id: "cred_pending",
      status: "pending",
      approved_at: null,
      rejected_at: null,
    });
    const approvedCredential = makeCredential({ id: "cred_approved" });

    const { rerender } = render(
      <CredentialCard credential={pendingCredential} selectionMode="reject" />,
      { wrapper: TestProviders },
    );
    expect(screen.getByRole("button", { name: /select credential/i })).toBeEnabled();

    rerender(<CredentialCard credential={approvedCredential} selectionMode="reject" />);
    expect(screen.getByRole("button", { name: /select credential/i })).toBeDisabled();
  });

  it("selects pending credentials on card click in approve mode", async () => {
    const user = userEvent.setup();
    const credential = makeCredential({
      status: "pending",
      approved_at: null,
      rejected_at: null,
    });
    const onSelect = vi.fn();

    render(<CredentialCard credential={credential} selectionMode="approve" onSelect={onSelect} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByText("Test Credential"));
    expect(onSelect).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
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

  it("renders revoked pill and revocation date for revoked credentials", () => {
    const credential = makeCredential({
      id: "cred_revoked",
      status: "revoked",
      revoked_at: "2026-06-01T00:00:00Z",
      revoker: makeUser({ id: "usr_revoker", role: Role.ISSUER, name: "Revoker User" }),
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(screen.getByText(/Jun 1, 2026/)).toBeInTheDocument();
  });

  it("shows submitted date (not issued) for a pending credential", () => {
    const credential = makeCredential({
      id: "cred_pending",
      status: "pending",
      approved_at: null,
      rejected_at: null,
      created_at: "2026-02-03T00:00:00Z",
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    expect(screen.getByText(/Feb 3, 2026/)).toBeInTheDocument();
  });

  it("shows issued date for a holder viewing their own approved credential", () => {
    const credential = makeCredential({
      issued_at: "2026-03-04T00:00:00Z",
    });

    render(<CredentialCard credential={credential} isHolder />, { wrapper: TestProviders });

    expect(screen.getByText(/Mar 4, 2026/)).toBeInTheDocument();
  });

  it("shows submitted date, not issued date, for a holder viewing their own pending credential", () => {
    const credential = makeCredential({
      status: "pending",
      approved_at: null,
      rejected_at: null,
      created_at: "2026-02-03T00:00:00Z",
      issued_at: "2022-01-01T00:00:00Z",
    });

    render(<CredentialCard credential={credential} isHolder />, { wrapper: TestProviders });

    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    expect(screen.getByText(/Feb 3, 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Jan 1, 2022/)).not.toBeInTheDocument();
  });

  it("renders extraction failed note when extraction failed and canManage", () => {
    const credential = makeCredential({
      id: "cred_failed",
      extract_state: "failed",
    });

    render(<CredentialCard credential={credential} canManage />, { wrapper: TestProviders });

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("hides extraction failed note when canManage is not set", () => {
    const credential = makeCredential({
      id: "cred_failed",
      extract_state: "failed",
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("renders the Approved badge for approved credential", () => {
    render(<CredentialCard credential={makeCredential({ status: "approved" })} />, { wrapper: TestProviders });

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("renders the Pending review badge for pending credential", () => {
    const credential = makeCredential({ status: "pending" });
    render(<CredentialCard credential={credential} />, {
      wrapper: TestProviders,
    });

    expect(screen.getByText("Pending review")).toBeInTheDocument();
  });

  it("renders the Revoked badge for revoked credential", () => {
    const credential = makeCredential({ status: "revoked", revoked_at: "2026-06-01T00:00:00Z" });
    render(<CredentialCard credential={credential} />, {
      wrapper: TestProviders,
    });

    expect(screen.getByText("Revoked")).toBeInTheDocument();
  });

  it("shows the holder's number and unit in the counterparty subline", () => {
    const credential = makeCredential({
      holder: makeUser({ id: "usr_anna", role: Role.HOLDER, name: "Anna Sorokin", number: "22090001" }),
    });

    render(<CredentialCard credential={credential} holderUnitName="Teknik Informatika" />, {
      wrapper: TestProviders,
    });

    const holderLink = screen.getByRole("link", { name: /anna sorokin/i });
    expect(holderLink.textContent).toBe("Anna Sorokin");
    expect(screen.getByText("22090001 · Teknik Informatika")).toBeInTheDocument();
  });

  it("shows the issuer organization name in the holder view", () => {
    const credential = makeCredential({
      issuer_organization: { id: "org_test_1", name: "Acme Institute" },
    });

    render(<CredentialCard credential={credential} isHolder />, { wrapper: TestProviders });

    expect(screen.getByText("Acme Institute")).toBeInTheDocument();
  });

  it("shows a pending indicator in the holder view when the issuer org is only staged", () => {
    const credential = makeCredential({
      issuer_organization: undefined,
      submitted_issuer_organization_name: "Acme Institute",
    });

    render(<CredentialCard credential={credential} isHolder />, { wrapper: TestProviders });

    expect(screen.getByText(/Acme Institute/)).toBeInTheDocument();
    expect(screen.getByText(/pending review/i)).toBeInTheDocument();
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
    const credential = makeCredential({ extract_state: "failed" });
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

  it("hides review affordances when canReview is false", () => {
    const credential = makeCredential({ status: "pending", approved_at: null });
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("hides review affordances in selection mode even when canReview is true", () => {
    const credential = makeCredential({ status: "pending", approved_at: null });
    render(<CredentialCard credential={credential} canReview selectionMode="reject" />, {
      wrapper: TestProviders,
    });

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("shows the Complete details CTA instead of Approve when details are unresolved", () => {
    const credential = makeCredential({
      status: "pending",
      approved_at: null,
      unresolved_metadata: ["competency"],
    });
    render(<CredentialCard credential={credential} canReview />, { wrapper: TestProviders });

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete details/i })).toBeInTheDocument();
  });

  it("navigates to the credential detail page when Complete details is clicked", async () => {
    const user = userEvent.setup();
    const credential = makeCredential({
      id: "cred_pending",
      status: "pending",
      approved_at: null,
      unresolved_metadata: ["competency"],
    });
    render(<CredentialCard credential={credential} canReview />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: /complete details/i }));
    expect(navigateMock).toHaveBeenCalledWith("/credentials/cred_pending");
  });

  it("calls onApprove with the credential id", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const credential = makeCredential({ id: "cred_pending", status: "pending", approved_at: null });

    render(<CredentialCard credential={credential} canReview onApprove={onApprove} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith("cred_pending");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("reveals an inline reason field on Reject click and submits it", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    const credential = makeCredential({ id: "cred_pending", status: "pending", approved_at: null });

    render(<CredentialCard credential={credential} canReview onReject={onReject} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const input = screen.getByPlaceholderText(/explain why/i);
    await user.type(input, "Wrong document");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(onReject).toHaveBeenCalledWith([{ id: "cred_pending", reason: "Wrong document" }]);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows competency names on a pending card with resolved details", () => {
    const credential = makeCredential({
      status: "pending",
      approved_at: null,
      competencies: [{ id: "comp_1", name: "Data Analysis" }],
    });

    render(<CredentialCard credential={credential} canReview />, { wrapper: TestProviders });

    expect(screen.getByText("Data Analysis")).toBeInTheDocument();
  });

  it("shows the details-incomplete indicator instead of competencies when metadata is unresolved", () => {
    const credential = makeCredential({
      status: "pending",
      approved_at: null,
      unresolved_metadata: ["type"],
      competencies: [{ id: "comp_1", name: "Data Analysis" }],
    });

    render(<CredentialCard credential={credential} canReview />, { wrapper: TestProviders });

    expect(screen.getByText("Details incomplete")).toBeInTheDocument();
    expect(screen.queryByText("Data Analysis")).not.toBeInTheDocument();
  });

  it("blocks reject submission when the reason is empty", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    const credential = makeCredential({ status: "pending", approved_at: null });

    render(<CredentialCard credential={credential} canReview onReject={onReject} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(onReject).not.toHaveBeenCalled();
    expect(screen.getByText(/rejection reason is required/i)).toBeInTheDocument();
  });
});
