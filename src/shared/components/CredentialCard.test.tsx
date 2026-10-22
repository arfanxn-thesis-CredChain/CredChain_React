import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { notify } from "@shared/lib/notify";
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
    expect(navigateMock).toHaveBeenCalledWith("/credentials?credential_id=cred_test_1");
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
      activated_at: null,
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
      activated_at: null,
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
      activated_at: null,
      rejected_at: null,
    });
    const onSelect = vi.fn();

    const { container } = render(
      <CredentialCard credential={credential} selectionMode="approve" onSelect={onSelect} />,
      { wrapper: TestProviders },
    );

    await user.click(container.firstChild as HTMLElement);
    expect(onSelect).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("opens credential detail when credential name is clicked in selection mode", async () => {
    const user = userEvent.setup();
    const credential = makeCredential({ status: "pending" });
    const onSelect = vi.fn();

    render(<CredentialCard credential={credential} selectionMode="approve" onSelect={onSelect} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByRole("button", { name: "Test Credential" }));
    expect(navigateMock).toHaveBeenCalledWith("/credentials?credential_id=cred_test_1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("opens details without selecting when title is activated with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CredentialCard credential={makeCredential()} selectionMode="revoke" onSelect={onSelect} />,
      { wrapper: TestProviders },
    );

    screen.getByRole("button", { name: "Test Credential" }).focus();
    await user.keyboard("{Enter}");

    expect(navigateMock).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects exactly once when selection button is activated with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CredentialCard credential={makeCredential()} selectionMode="revoke" onSelect={onSelect} />,
      { wrapper: TestProviders },
    );

    screen.getByRole("button", { name: /select credential/i }).focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledOnce();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("names select and deselect buttons for the credential in both locales", async () => {
    const credential = makeCredential({ name: "Specific Diploma" });
    const { rerender } = render(<CredentialCard credential={credential} selectionMode="revoke" />, {
      wrapper: TestProviders,
    });

    expect(
      screen.getByRole("button", { name: "Select credential: Specific Diploma" }),
    ).toBeEnabled();
    rerender(<CredentialCard credential={credential} selectionMode="revoke" isSelected />);
    expect(
      screen.getByRole("button", { name: "Deselect credential: Specific Diploma" }),
    ).toHaveAttribute("aria-pressed", "true");

    await i18n.changeLanguage("id");
    rerender(<CredentialCard credential={credential} selectionMode="revoke" />);
    expect(
      screen.getByRole("button", { name: "Pilih kredensial: Specific Diploma" }),
    ).toBeEnabled();
    rerender(<CredentialCard credential={credential} selectionMode="revoke" isSelected />);
    expect(
      screen.getByRole("button", { name: "Batal pilih kredensial: Specific Diploma" }),
    ).toHaveAttribute("aria-pressed", "true");
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
      activated_at: null,
      rejected_at: null,
      created_at: "2026-02-03T00:00:00Z",
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    expect(screen.getByText(/Feb 3, 2026/)).toBeInTheDocument();
  });

  it("shows approved date for an approved submission credential", () => {
    const credential = makeCredential({
      status: "approved",
      activated_at: "2026-03-04T00:00:00Z",
    });

    render(<CredentialCard credential={credential} isHolder />, { wrapper: TestProviders });

    expect(screen.getByText(/Mar 4, 2026/)).toBeInTheDocument();
  });

  it("shows submitted date, not registered date, for a holder viewing their own pending credential", () => {
    const credential = makeCredential({
      status: "pending",
      activated_at: null,
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
    render(<CredentialCard credential={makeCredential({ status: "approved" })} />, {
      wrapper: TestProviders,
    });

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("renders the Registered badge and aria-label for direct-issued credential", () => {
    const directCred = makeCredential({
      status: "approved",
      submitter_user_id: "usr_test_2",
      holder_user_id: "usr_test_1",
    });
    render(<CredentialCard credential={directCred} />, { wrapper: TestProviders });

    expect(screen.getByText("Registered")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /registered/i })).toBeInTheDocument();
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
      holder: makeUser({
        id: "usr_anna",
        role: Role.HOLDER,
        name: "Anna Sorokin",
        number: "22090001",
      }),
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

    const { container } = render(<CredentialCard credential={credential} isHolder />, {
      wrapper: TestProviders,
    });

    const stagedEl = screen.getByText(/Acme Institute/);
    expect(stagedEl).toBeInTheDocument();
    expect(stagedEl.className).toContain("min-w-0");
    expect(stagedEl.className).toContain("break-words");
    expect(container.querySelector("svg.lucide-circle-dashed")).toBeInTheDocument();
  });

  it("shows the audit row and hides holder when showActor is true on active credential", () => {
    const credential = makeCredential({
      holder_user_id: "usr_h",
      issuer_user_id: "usr_i",
      submitter_user_id: "usr_i",
      holder: makeUser({ id: "usr_h", role: Role.HOLDER, name: "Alice Holder" }),
      issuer: makeUser({ id: "usr_i", role: Role.ISSUER, name: "Bob Issuer", number: "12345" }),
    });

    render(<CredentialCard credential={credential} showActor />, { wrapper: TestProviders });

    expect(screen.getByText("Bob Issuer")).toBeInTheDocument();
    expect(screen.getByText("Registered by")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.queryByText("Alice Holder")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /bob issuer/i })).toHaveAttribute(
      "href",
      "/users/usr_i",
    );
  });

  it("shows Approved by when approved credential was submitted by holder", () => {
    const credential = makeCredential({
      holder_user_id: "usr_self",
      submitter_user_id: "usr_self",
      issuer_user_id: "usr_officer",
      holder: makeUser({ id: "usr_self", role: Role.HOLDER, name: "Alice Self" }),
      issuer: makeUser({ id: "usr_officer", role: Role.ISSUER, name: "Officer Bob" }),
    });

    render(<CredentialCard credential={credential} showActor />, { wrapper: TestProviders });

    expect(screen.getByText("Approved by")).toBeInTheDocument();
    expect(screen.getByText("Officer Bob")).toBeInTheDocument();
    expect(screen.queryByText("Alice Self")).not.toBeInTheDocument();
    expect(screen.queryByText("Issuer")).not.toBeInTheDocument();
    expect(screen.queryByText("Self-submitted")).not.toBeInTheDocument();
  });

  it("shows the revoker and hides issuer/holder when showActor is true on revoked credential", () => {
    const credential = makeCredential({
      id: "cred_revoked",
      status: "revoked",
      revoked_at: "2026-06-01T00:00:00Z",
      holder_user_id: "usr_h",
      issuer_user_id: "usr_i",
      revoker_user_id: "usr_r",
      holder: makeUser({ id: "usr_h", role: Role.HOLDER, name: "Alice Holder" }),
      issuer: makeUser({ id: "usr_i", role: Role.ISSUER, name: "Bob Issuer" }),
      revoker: makeUser({ id: "usr_r", role: Role.ADMIN, name: "Charlie Revoker" }),
    });

    render(<CredentialCard credential={credential} showActor />, { wrapper: TestProviders });

    expect(screen.getByText("Charlie Revoker")).toBeInTheDocument();
    expect(screen.getByText("Revoked by")).toBeInTheDocument();
    expect(screen.queryByText("Bob Issuer")).not.toBeInTheDocument();
    expect(screen.queryByText("Alice Holder")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /charlie revoker/i })).toHaveAttribute(
      "href",
      "/users/usr_r",
    );
  });

  it("shows the rejecter and hides issuer/holder when hideHolder is true on rejected credential", () => {
    const credential = makeCredential({
      id: "cred_rejected",
      status: "rejected",
      rejected_at: "2026-06-01T00:00:00Z",
      holder_user_id: "usr_h",
      issuer_user_id: "usr_i",
      rejecter_user_id: "usr_rej",
      holder: makeUser({ id: "usr_h", role: Role.HOLDER, name: "Alice Holder" }),
      issuer: makeUser({ id: "usr_i", role: Role.ISSUER, name: "Bob Issuer" }),
      rejecter: makeUser({
        id: "usr_rej",
        role: Role.ISSUER,
        name: "Dave Rejecter",
        number: "98765",
      }),
    });

    render(<CredentialCard credential={credential} hideHolder />, { wrapper: TestProviders });

    expect(screen.getByText("Dave Rejecter")).toBeInTheDocument();
    expect(screen.getByText("Rejected by")).toBeInTheDocument();
    expect(screen.getByText("98765")).toBeInTheDocument();
    expect(screen.queryByText("Bob Issuer")).not.toBeInTheDocument();
    expect(screen.queryByText("Alice Holder")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dave rejecter/i })).toHaveAttribute(
      "href",
      "/users/usr_rej",
    );
  });

  it("shows the issuing organization eyebrow label above the organization name in holder view", () => {
    const credential = makeCredential({
      issuer_organization: { id: "org_test_1", name: "Acme Institute" },
    });

    render(<CredentialCard credential={credential} isHolder />, { wrapper: TestProviders });

    expect(screen.getByText("Issuing organization")).toBeInTheDocument();
    expect(screen.getByText("Acme Institute")).toBeInTheDocument();
  });

  it("renders competencies with overflow count", () => {
    const credential = makeCredential({
      competencies: [
        { id: "comp_1", name: "Psikometri" },
        { id: "comp_2", name: "Statistika" },
        { id: "comp_3", name: "Metodologi" },
      ],
    });

    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.getByText("Psikometri")).toBeInTheDocument();
    expect(screen.getByText("Statistika")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("renders holder info and audit strip when showActor is false and issuer is present", () => {
    const credential = makeCredential({
      holder_user_id: "usr_h",
      issuer_user_id: "usr_i",
      submitter_user_id: "usr_i",
      holder: makeUser({ id: "usr_h", role: Role.HOLDER, name: "Alice Holder" }),
      issuer: makeUser({ id: "usr_i", role: Role.ISSUER, name: "Bob Issuer" }),
    });

    render(<CredentialCard credential={credential} showActor={false} />, {
      wrapper: TestProviders,
    });

    expect(screen.getByText("Alice Holder")).toBeInTheDocument();
    expect(screen.getByText("Bob Issuer")).toBeInTheDocument();
    expect(screen.queryByText("Issuer")).not.toBeInTheDocument();
  });

  it("toggles selection instead of navigating when card is clicked in revoke mode", async () => {
    const user = userEvent.setup();
    const credential = makeCredential();
    const onSelect = vi.fn();

    const { container } = render(
      <CredentialCard credential={credential} selectionMode="revoke" onSelect={onSelect} />,
      { wrapper: TestProviders },
    );

    await user.click(container.firstChild as HTMLElement);
    expect(onSelect).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("toggles selection instead of navigating when card is clicked in re-extract mode", async () => {
    const user = userEvent.setup();
    const credential = makeCredential({ extract_state: "failed" });
    const onSelect = vi.fn();

    const { container } = render(
      <CredentialCard credential={credential} selectionMode="reextract" onSelect={onSelect} />,
      { wrapper: TestProviders },
    );

    await user.click(container.firstChild as HTMLElement);
    expect(onSelect).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not navigate when clicking an ineligible card in selection mode", async () => {
    const user = userEvent.setup();
    const credential = makeCredential({ revoked_at: "2026-06-01T00:00:00Z" });

    const { container } = render(
      <CredentialCard credential={credential} selectionMode="revoke" />,
      { wrapper: TestProviders },
    );

    await user.click(container.firstChild as HTMLElement);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("keeps detail navigation available when selectDisabled is true", async () => {
    const user = userEvent.setup();
    const credential = makeCredential();
    render(<CredentialCard credential={credential} selectionMode="revoke" selectDisabled />, {
      wrapper: TestProviders,
    });

    const card = screen.getByRole("link", { name: /approved/i });
    expect(card.className).not.toContain("cursor-not-allowed");
    await user.click(screen.getByRole("button", { name: "Test Credential" }));
    expect(navigateMock).toHaveBeenCalledWith("/credentials?credential_id=cred_test_1");
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
    const credential = makeCredential({ status: "pending", activated_at: null });
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("hides review affordances in selection mode even when canReview is true", () => {
    const credential = makeCredential({ status: "pending", activated_at: null });
    render(<CredentialCard credential={credential} canReview selectionMode="reject" />, {
      wrapper: TestProviders,
    });

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it.each(["type", "issuer_organization", "competency"] as const)(
    "shows Complete details and Reject instead of Approve when %s is unresolved",
    (field) => {
      const credential = makeCredential({
        status: "pending",
        activated_at: null,
        unresolved_metadata: [field],
      });
      render(<CredentialCard credential={credential} canReview />, { wrapper: TestProviders });

      expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /complete details/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    },
  );

  it("shows Complete details instead of Approve for known inactive references", () => {
    render(
      <CredentialCard
        credential={makeCredential({
          status: "pending",
          type: { id: "type", name: "Retired", active: false },
        })}
        canReview
      />,
      { wrapper: TestProviders },
    );

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete details/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("navigates to the credential detail page when Complete details is clicked", async () => {
    const user = userEvent.setup();
    const credential = makeCredential({
      id: "cred_pending",
      status: "pending",
      activated_at: null,
      unresolved_metadata: ["competency"],
    });
    render(<CredentialCard credential={credential} canReview />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: /complete details/i }));
    expect(navigateMock).toHaveBeenCalledWith("/credentials?credential_id=cred_pending");
  });

  it("calls onApprove with the credential id", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const credential = makeCredential({
      id: "cred_pending",
      status: "pending",
      activated_at: null,
    });

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
    const credential = makeCredential({
      id: "cred_pending",
      status: "pending",
      activated_at: null,
    });

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

  it("requires a reason before rejecting unresolved details and submits a trimmed reason", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    const credential = makeCredential({
      id: "cred_unresolved",
      status: "pending",
      activated_at: null,
      unresolved_metadata: ["issuer_organization"],
    });
    render(<CredentialCard credential={credential} canReview onReject={onReject} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.queryByRole("button", { name: /complete details/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).not.toHaveBeenCalled();
    expect(screen.getByText(/rejection reason is required/i)).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: /rejection reason/i }),
      "  Wrong document  ",
    );
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledWith([{ id: "cred_unresolved", reason: "Wrong document" }]);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows competency names on a pending card with resolved details", () => {
    const credential = makeCredential({
      status: "pending",
      activated_at: null,
      competencies: [
        { id: "comp_1", name: "Data Analysis" },
        { id: "comp_2", name: "Machine Learning" },
      ],
    });

    render(<CredentialCard credential={credential} canReview />, { wrapper: TestProviders });

    const compEl = screen.getByText("Data Analysis");
    expect(compEl).toBeInTheDocument();
    expect(compEl.className).toContain("truncate");
  });

  it("allows long title words to break and wrap cleanly", () => {
    const credential = makeCredential({
      name: "VeryLongUnbrokenCredentialNameThatCouldBreakCardLayoutIfNotWrappedProperly",
    });
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.className).toContain("wrap-break-word");
    expect(heading.className).toContain("line-clamp-2");
  });

  it("wraps header row to prevent squashing the status pill", () => {
    const credential = makeCredential({
      type: { id: "type_1", name: "Extremely Long Credential Type Name That Needs Space" },
    });
    render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

    const pill = screen.getByText(/^approved$/i);
    const headerRow = pill.closest("div.mb-3");
    expect(headerRow?.className).toContain("flex-wrap");
  });

  it("does not use text-gray-400 for visible text nodes", () => {
    const credential = makeCredential({
      status: "pending",
      activated_at: null,
      unresolved_metadata: ["type"],
      extract_state: "pending",
      submitted_issuer_organization_name: "Acme Institute",
      issuer_organization: undefined,
    });

    const { container } = render(
      <CredentialCard credential={credential} canReview canManage isHolder />,
      { wrapper: TestProviders },
    );

    const gray400Elements = container.querySelectorAll(".text-gray-400");
    expect(gray400Elements.length).toBeGreaterThan(0); // confirms there are calendar icons or similar tested
    gray400Elements.forEach((el) => {
      expect(el.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("renders competencies directly even when metadata is unresolved", () => {
    const credential = makeCredential({
      status: "pending",
      activated_at: null,
      unresolved_metadata: ["type"],
      competencies: [{ id: "comp_1", name: "Data Analysis" }],
    });

    render(<CredentialCard credential={credential} canReview />, { wrapper: TestProviders });

    expect(screen.queryByText("Details incomplete")).not.toBeInTheDocument();
    expect(screen.getByText("Data Analysis")).toBeInTheDocument();
  });

  it("blocks reject submission when the reason is empty", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    const credential = makeCredential({ status: "pending", activated_at: null });

    render(<CredentialCard credential={credential} canReview onReject={onReject} />, {
      wrapper: TestProviders,
    });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(onReject).not.toHaveBeenCalled();
    expect(screen.getByText(/rejection reason is required/i)).toBeInTheDocument();
  });

  describe("holder counterparty view", () => {
    it("renders org name and issuer person row in audit strip when credential was issued via issuance", () => {
      const credential = makeCredential({
        holder_user_id: "usr_h",
        issuer_user_id: "usr_i",
        submitter_user_id: "usr_i",
        issuer_organization: { id: "org_1", name: "MIT University" },
        issuer: makeUser({ id: "usr_i", role: Role.ISSUER, name: "Prof Bob", number: "INS-99" }),
      });

      render(<CredentialCard credential={credential} isHolder />, { wrapper: TestProviders });

      expect(screen.getByText("MIT University")).toBeInTheDocument();
      expect(screen.getByText("Prof Bob")).toBeInTheDocument();
      expect(screen.getByText("Registered by")).toBeInTheDocument();
      expect(screen.getByText("INS-99")).toBeInTheDocument();
      expect(screen.queryByText("Issuer")).not.toBeInTheDocument();
    });

    it("renders Approved by in audit strip when approved submission viewed by holder", () => {
      const credential = makeCredential({
        holder_user_id: "usr_h",
        submitter_user_id: "usr_h",
        issuer_user_id: "usr_officer",
        issuer_organization: { id: "org_1", name: "MIT University" },
        holder: makeUser({ id: "usr_h", role: Role.HOLDER, name: "Alice Holder" }),
        issuer: makeUser({ id: "usr_officer", role: Role.ISSUER, name: "Officer Bob" }),
      });

      render(<CredentialCard credential={credential} isHolder />, { wrapper: TestProviders });

      expect(screen.getByText("MIT University")).toBeInTheDocument();
      expect(screen.getByText("Officer Bob")).toBeInTheDocument();
      expect(screen.getByText("Approved by")).toBeInTheDocument();
      expect(screen.queryByText("Issuer")).not.toBeInTheDocument();
      expect(screen.queryByText("Self-submitted")).not.toBeInTheDocument();
    });

    it("renders org name and revoker person row when revoked", () => {
      const credential = makeCredential({
        id: "cred_rev",
        status: "revoked",
        revoked_at: "2026-06-01T00:00:00Z",
        holder_user_id: "usr_h",
        issuer_user_id: "usr_i",
        revoker_user_id: "usr_r",
        issuer_organization: { id: "org_1", name: "MIT University" },
        issuer: makeUser({ id: "usr_i", role: Role.ISSUER, name: "Prof Bob" }),
        revoker: makeUser({ id: "usr_r", role: Role.ADMIN, name: "Dean Charlie", number: "ADM-1" }),
      });

      render(<CredentialCard credential={credential} isHolder />, { wrapper: TestProviders });

      expect(screen.getByText("MIT University")).toBeInTheDocument();
      expect(screen.getByText("Dean Charlie")).toBeInTheDocument();
      expect(screen.getByText("Revoked by")).toBeInTheDocument();
      expect(screen.getByText("ADM-1")).toBeInTheDocument();
      expect(screen.queryByText("Prof Bob")).not.toBeInTheDocument();
    });
  });

  describe("bulk selection eligibility", () => {
    it("explains unresolved approval fields without disabling detail navigation or rejection", async () => {
      const user = userEvent.setup();
      const credential = makeCredential({
        status: "pending",
        unresolved_metadata: ["type", "issuer_organization", "competency"],
      });
      const onSelect = vi.fn();
      const { rerender } = render(
        <CredentialCard credential={credential} selectionMode="approve" onSelect={onSelect} />,
        { wrapper: TestProviders },
      );
      const checkbox = screen.getByRole("button", { name: /select credential/i });
      expect(checkbox).toBeDisabled();
      expect(
        screen.getByText(/resolve.*credential type.*issuing organization.*competenc/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /pending review/i }).className).not.toContain(
        "opacity-50",
      );
      await user.click(screen.getByRole("button", { name: "Test Credential" }));
      expect(navigateMock).toHaveBeenCalledWith("/credentials?credential_id=cred_test_1");
      expect(onSelect).not.toHaveBeenCalled();
      rerender(
        <CredentialCard credential={credential} selectionMode="reject" onSelect={onSelect} />,
      );
      expect(screen.getByRole("button", { name: /select credential/i })).toBeEnabled();
    });

    it("explains inactive references and a missing re-extraction file", () => {
      const { rerender } = render(
        <CredentialCard
          credential={makeCredential({
            status: "pending",
            type: { id: "type", name: "Retired", active: false },
          })}
          selectionMode="approve"
        />,
        { wrapper: TestProviders },
      );
      expect(screen.getByText(/inactive.*credential type/i)).toBeInTheDocument();
      rerender(
        <CredentialCard
          credential={makeCredential({ extract_state: "failed", file_uri: null })}
          selectionMode="reextract"
        />,
      );
      expect(screen.getByRole("button", { name: /select credential/i })).toBeDisabled();
      expect(screen.getByText(/file.*unavailable/i)).toBeInTheDocument();
    });

    it("disables checkbox when credential is not eligible for mode", () => {
      const credential = makeCredential({ status: "pending", activated_at: null });

      render(<CredentialCard credential={credential} selectionMode="revoke" />, {
        wrapper: TestProviders,
      });

      const card = screen.getByRole("link", { name: /pending review/i });
      expect(card.className).not.toContain("opacity-50");
      expect(card.className).not.toContain("cursor-not-allowed");

      const checkbox = screen.getByRole("button", { name: /select credential/i });
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute("aria-describedby");
      expect(screen.getByText(/only approved credentials/i)).toBeInTheDocument();
      expect(checkbox.className).toContain("cursor-not-allowed");
      expect(checkbox.className).not.toContain("opacity-30");
    });

    it("explains an expired unactivated credential is not eligible for revocation", () => {
      const credential = makeCredential({
        status: "expired",
        activated_at: null,
        expires_at: "2026-02-01T00:00:00Z",
      });

      render(<CredentialCard credential={credential} selectionMode="revoke" />, {
        wrapper: TestProviders,
      });

      expect(screen.getByRole("button", { name: /select credential/i })).toBeDisabled();
      expect(screen.getByText(/only approved credentials/i)).toBeInTheDocument();
      expect(screen.queryByText("This credential is already expired.")).not.toBeInTheDocument();
    });

    it("keeps card at full contrast and checkbox enabled when credential is eligible", () => {
      const credential = makeCredential({ status: "approved" });

      render(<CredentialCard credential={credential} selectionMode="revoke" />, {
        wrapper: TestProviders,
      });

      const card = screen.getByRole("link", { name: /approved/i });
      expect(card.className).not.toContain("opacity-50");
      expect(card.className).not.toContain("cursor-not-allowed");

      const checkbox = screen.getByRole("button", { name: /select credential/i });
      expect(checkbox).not.toBeDisabled();
      expect(checkbox.className).not.toContain("cursor-not-allowed");
    });

    it("keeps card readable when selection cap is reached", () => {
      const credential = makeCredential({ status: "approved" });

      render(<CredentialCard credential={credential} selectionMode="revoke" selectDisabled />, {
        wrapper: TestProviders,
      });

      const card = screen.getByRole("link", { name: /approved/i });
      expect(card.className).not.toContain("opacity-50");
      expect(card.className).not.toContain("cursor-not-allowed");
      const checkbox = screen.getByRole("button", { name: /select credential/i });
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute("aria-describedby");
      expect(screen.getByText(/maximum of 100 credentials selected/i)).toBeInTheDocument();
    });

    it("displays a toast warning with the card explanation when attempting to select a blocked credential", async () => {
      const user = userEvent.setup();
      const warningSpy = vi.spyOn(notify, "warning").mockImplementation(() => {});
      const credential = makeCredential({
        status: "pending",
        unresolved_metadata: ["type", "issuer_organization"],
      });
      render(
        <CredentialCard credential={credential} selectionMode="approve" onSelect={vi.fn()} />,
        { wrapper: TestProviders },
      );

      const selectButton = screen.getByRole("button", { name: /select credential/i });
      expect(selectButton).toBeDisabled();

      await user.click(selectButton.parentElement ?? selectButton);

      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringMatching(/resolve.*credential type.*issuing organization/i),
      );
      warningSpy.mockRestore();
    });

    it("displays a toast warning when clicking the card body of a blocked credential in approve mode", async () => {
      const user = userEvent.setup();
      const warningSpy = vi.spyOn(notify, "warning").mockImplementation(() => {});
      const credential = makeCredential({
        status: "pending",
        unresolved_metadata: ["competency"],
      });
      const { container } = render(
        <CredentialCard credential={credential} selectionMode="approve" onSelect={vi.fn()} />,
        { wrapper: TestProviders },
      );

      const card = container.firstElementChild as HTMLElement;
      await user.click(card);

      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringMatching(/resolve.*competenc/i),
      );
      warningSpy.mockRestore();
    });
  });

  describe("taxonomy and visual indicators", () => {
    it("renders staged type name with pending indicator and resolved type plain", () => {
      const stagedCred = makeCredential({
        type: undefined,
        submitted_type_name: "Staged Workshop",
      });
      const { rerender, container } = render(<CredentialCard credential={stagedCred} />, {
        wrapper: TestProviders,
      });

      expect(screen.getByText(/Staged Workshop/)).toBeInTheDocument();
      expect(container.querySelector("svg.lucide-circle-dashed")).toBeInTheDocument();

      const resolvedCred = makeCredential({
        type: { id: "type_1", name: "Resolved Degree" },
        submitted_type_name: "Staged Workshop",
      });
      rerender(<CredentialCard credential={resolvedCred} />);

      expect(screen.getByText("Resolved Degree")).toBeInTheDocument();
      expect(screen.queryByText(/Staged Workshop/)).not.toBeInTheDocument();
    });

    it("renders raw competencies from meta when stored as an array of strings", () => {
      const credential = makeCredential({
        competencies: [],
        submitted_competencies: [],
        meta: { competencies: ["Machine Learning", "Cloud Computing"] },
      });

      render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

      expect(screen.getByText("Machine Learning")).toBeInTheDocument();
      expect(screen.getByText("Cloud Computing")).toBeInTheDocument();
    });

    it("renders raw competencies from meta when stored as a single string", () => {
      const credential = makeCredential({
        competencies: [],
        submitted_competencies: [],
        meta: { competency: "Cybersecurity" },
      });

      render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

      expect(screen.getByText("Cybersecurity")).toBeInTheDocument();
    });

    it("renders resolved and staged competencies with distinct tones and overflow at 3+", () => {
      const credential = makeCredential({
        competencies: [{ id: "comp_1", name: "Resolved Python" }],
        submitted_competencies: [
          { name: "Staged Rust", resolved_id: null },
          { name: "Staged Go", resolved_id: null },
        ],
      });

      render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

      const resolvedEl = screen.getByText("Resolved Python");
      expect(resolvedEl).toBeInTheDocument();
      expect(resolvedEl.className).toContain("text-navy");

      const stagedEl = screen.getByText("Staged Rust");
      expect(stagedEl).toBeInTheDocument();
      expect(stagedEl.className).toContain("text-gray-600");

      expect(screen.getByText("+1")).toBeInTheDocument();
      expect(screen.queryByText("Staged Go")).not.toBeInTheDocument();
    });

    it("applies semantic surface colors: revoked is gray, rejected is red", () => {
      const revokedCred = makeCredential({
        status: "revoked",
        revoked_at: "2026-06-01T00:00:00Z",
      });
      const { rerender } = render(<CredentialCard credential={revokedCred} />, {
        wrapper: TestProviders,
      });

      const revokedCard = screen.getByRole("link", { name: /revoked/i });
      expect(revokedCard.className).toContain("bg-gray-50");
      expect(revokedCard.className).toContain("border-gray-200");

      const rejectedCred = makeCredential({
        status: "rejected",
        rejected_at: "2026-06-01T00:00:00Z",
      });
      rerender(<CredentialCard credential={rejectedCred} />);

      const rejectedCard = screen.getByRole("link", { name: /rejected/i });
      expect(rejectedCard.className).toContain("bg-error/5");
      expect(rejectedCard.className).toContain("border-error/20");
    });

    it("announces truthful aria-labels reflecting each status", () => {
      const statuses = [
        { status: "pending", name: /pending review/i },
        { status: "approved", name: /approved/i },
        { status: "rejected", name: /rejected/i },
        { status: "revoked", name: /revoked/i },
      ] as const;

      for (const { status, name } of statuses) {
        const cred = makeCredential({ status });
        const { unmount } = render(<CredentialCard credential={cred} />, {
          wrapper: TestProviders,
        });
        expect(screen.getByRole("link", { name })).toBeInTheDocument();
        unmount();
      }
    });

    it("renders issuing organization in non-holder view as well", () => {
      const credential = makeCredential({
        issuer_organization: { id: "org_1", name: "Global Certification Board" },
      });

      render(<CredentialCard credential={credential} isHolder={false} />, {
        wrapper: TestProviders,
      });

      expect(screen.getByText("Issuing organization")).toBeInTheDocument();
      expect(screen.getByText("Global Certification Board")).toBeInTheDocument();
    });

    it("does not display the retired Issuer role label in any status", () => {
      const pendingCred = makeCredential({ status: "pending" });
      const approvedCred = makeCredential({ status: "approved" });
      const rejectedCred = makeCredential({ status: "rejected" });
      const revokedCred = makeCredential({ status: "revoked" });

      for (const cred of [pendingCred, approvedCred, rejectedCred, revokedCred]) {
        const { unmount } = render(<CredentialCard credential={cred} showActor />, {
          wrapper: TestProviders,
        });
        expect(screen.queryByText(/^issuer$/i)).not.toBeInTheDocument();
        unmount();
      }
    });

    it("renders no audit strip when credential is pending", () => {
      const credential = makeCredential({
        status: "pending",
        activated_at: null,
      });

      render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

      expect(screen.queryByText("Approved by")).not.toBeInTheDocument();
      expect(screen.queryByText("Registered by")).not.toBeInTheDocument();
      expect(screen.queryByText("Rejected by")).not.toBeInTheDocument();
      expect(screen.queryByText("Revoked by")).not.toBeInTheDocument();
    });

    it("splits approved audit strip by origin: Approved by for submissions, Registered by for direct registration", () => {
      const submissionCred = makeCredential({
        status: "approved",
        holder_user_id: "usr_alice",
        submitter_user_id: "usr_alice",
        issuer: makeUser({ id: "usr_staff", name: "Staff Reviewer" }),
      });
      const { rerender } = render(<CredentialCard credential={submissionCred} />, {
        wrapper: TestProviders,
      });

      expect(screen.getByText("Approved by")).toBeInTheDocument();
      expect(screen.queryByText("Registered by")).not.toBeInTheDocument();

      const directCred = makeCredential({
        status: "approved",
        holder_user_id: "usr_alice",
        submitter_user_id: "usr_staff",
        issuer: makeUser({ id: "usr_staff", name: "Staff Reviewer" }),
      });
      rerender(<CredentialCard credential={directCred} />);

      expect(screen.getByText("Registered by")).toBeInTheDocument();
      expect(screen.queryByText("Approved by")).not.toBeInTheDocument();
    });

    it("displays rejection reason when status is rejected and reason is present", () => {
      const credential = makeCredential({
        status: "rejected",
        rejected_at: "2026-06-01T00:00:00Z",
        rejection_reason: "Document signature is invalid",
        rejecter: makeUser({ id: "usr_rej", name: "Reviewer Admin" }),
      });

      render(<CredentialCard credential={credential} />, { wrapper: TestProviders });

      expect(screen.getByText("Rejection reason:")).toBeInTheDocument();
      expect(screen.getByText("Document signature is invalid")).toBeInTheDocument();
    });
  });
});
