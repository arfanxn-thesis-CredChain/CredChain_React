import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/test/TestProviders";
import { makeCredential, makeUser } from "@/test/fixtures";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { useStore } from "@app/store";
import { VerifyCredential } from "./VerifyCredential";

const mockMutateAsync = vi.fn();
const mockUseCredential = vi.fn();
vi.mock("./CredentialDetailModal", () => ({
  CredentialDetailModal: ({ credentialId }: { credentialId: string }) => (
    <div role="dialog" aria-label="Private credential details">
      Private record {credentialId}
    </div>
  ),
}));
vi.mock("./api/useCredential", () => ({
  useCredential: (...args: unknown[]) => mockUseCredential(...args),
}));
vi.mock("./api/useVerifyCredential", () => ({
  useVerifyCredential: () => ({ mutateAsync: mockMutateAsync }),
}));
vi.mock("./components/CredentialFileInput", () => ({
  CredentialFileInput: ({
    file,
    onChange,
    onExpand,
    error,
  }: {
    file: File | null;
    onChange: (file: File | null) => void;
    onExpand: () => void;
    error?: string;
  }) => (
    <div>
      {file ? (
        <>
          <span>{file.name}</span>
          <button
            onClick={() =>
              onChange(new File(["replacement"], "other.pdf", { type: "application/pdf" }))
            }
          >
            Replace
          </button>
          <button
            onClick={() =>
              onChange(new File(["bad"], "bad.exe", { type: "application/octet-stream" }))
            }
          >
            Invalid replacement
          </button>
          <button onClick={onExpand}>Preview upload</button>
          <button onClick={() => onChange(null)}>Remove</button>
        </>
      ) : (
        <>
          <span>Drag &amp; drop</span>
          <button
            onClick={() => onChange(new File(["test"], "test.pdf", { type: "application/pdf" }))}
          >
            Select file
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  ),
}));
vi.mock("./components/CredentialFileModal", () => ({
  CredentialFileModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="File preview" /> : null,
}));

const credential = {
  id: "matched",
  name: "Public Certificate",
  status: "approved" as const,
  is_submission: false,
  issuer_organization_id: "org",
  issuer_organization_name: "Actual School",
  number: "D-2026",
  file_hash: "0xabc",
  issued_at: "2026-01-01",
  expires_at: null,
};
const exact = {
  verdict_code: 400401,
  description: "server text",
  similarity_score: null,
  similarity_percent: null,
  credential,
  exact_match_confirmed: true,
  public_details: {
    ...credential,
    issuer_organization_name: "Actual School",
    credential_type_name: "Diploma",
    revoked_at: null,
    holder: null,
    competencies: [],
    meta: null,
    token_id: "42",
    created_at: "2026-01-01",
    activated_at: "2026-01-02",
    rejected_at: null,
  },
};
function renderVerify() {
  return render(<VerifyCredential />, { wrapper: TestProviders });
}
async function verifyFile() {
  const user = userEvent.setup();
  await user.click(screen.getByText("Select file"));
  await user.click(screen.getByRole("button", { name: /Verify Document/i }));
  return user;
}

describe("VerifyCredential", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    mockUseCredential.mockReturnValue({ data: undefined });
    await i18n.changeLanguage("en");
    useStore.setState({ user: null, isAuthenticated: false });
  });

  it.each(["en", "id"])(
    "renders specific upload context in %s without a file",
    async (language) => {
      await i18n.changeLanguage(language);
      const { container } = renderVerify();
      expect(
        screen.getByText(language === "en" ? "Credential Verification" : "Verifikasi Kredensial"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          language === "en"
            ? "Upload a document to check it against credentials in CredChain."
            : "Unggah dokumen untuk diperiksa terhadap kredensial di CredChain.",
        ),
      ).toBeInTheDocument();
      expect(container.textContent).not.toMatch(
        /\b(records?|catatan|rekaman|entries|entry|entri|registry)\b/i,
      );
      expect(screen.getByText("Drag & drop")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: i18n.t("cred.verify.verifyNow") })).toBeDisabled();
    },
  );
  it("enables verification after selecting a file", async () => {
    renderVerify();
    await userEvent.click(screen.getByText("Select file"));
    expect(screen.getByRole("button", { name: /Verify Document/i })).toBeEnabled();
    expect(screen.getByText("test.pdf")).toBeInTheDocument();
  });

  it("opens anonymous public details without protected lookup or global branding", async () => {
    mockMutateAsync.mockResolvedValueOnce(exact);
    renderVerify();
    const user = await verifyFile();
    expect(screen.getByRole("heading", { name: "Verification result" })).toHaveFocus();
    expect(screen.getByText("Actual School")).toBeInTheDocument();
    expect(mockUseCredential).toHaveBeenLastCalledWith("");
    expect(screen.queryByText("University of Indonesia")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View credential details" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Actual School");
    expect(screen.getByRole("dialog")).toHaveTextContent("Diploma");
    expect(screen.queryByRole("link", { name: "Open private record" })).not.toBeInTheDocument();
    await act(() => i18n.changeLanguage("id"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Organisasi penerbit");
    await act(() => i18n.changeLanguage("en"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View credential details" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Preview upload" }));
    expect(screen.getByRole("dialog", { name: "File preview" })).toBeInTheDocument();
  });

  it.each([
    { role: Role.HOLDER, owner: true, allowed: true },
    { role: Role.HOLDER, owner: false, allowed: false },
    { role: Role.ISSUER, owner: false, allowed: true },
  ])(
    "keeps private action authorized for $role / owner $owner",
    async ({ role, owner, allowed }) => {
      useStore.setState({ user: makeUser({ id: "viewer", role }), isAuthenticated: true });
      mockUseCredential.mockReturnValue({
        data: makeCredential({ id: "matched", holder_user_id: owner ? "viewer" : "other" }),
      });
      mockMutateAsync.mockResolvedValueOnce(exact);
      renderVerify();
      const user = await verifyFile();
      expect(mockUseCredential).toHaveBeenLastCalledWith("matched");
      expect(screen.queryByRole("link", { name: "Open private record" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "View credential details" }));
      expect(screen.getByRole("dialog")).toHaveTextContent(
        allowed ? "Private record matched" : "Actual School",
      );
    },
  );

  it.each(["Forbidden", "Not found"])(
    "retains public details after protected lookup %s",
    async (message) => {
      useStore.setState({ user: makeUser({ role: Role.HOLDER }), isAuthenticated: true });
      mockUseCredential.mockReturnValue({ data: undefined, error: new Error(message) });
      mockMutateAsync.mockResolvedValueOnce(exact);
      renderVerify();
      const user = await verifyFile();
      await user.click(screen.getByRole("button", { name: "View credential details" }));
      expect(screen.getByRole("dialog")).toHaveTextContent("Actual School");
      expect(screen.queryByRole("link", { name: "Open private record" })).not.toBeInTheDocument();
    },
  );
  it("closes private details on logout and does not reopen them after reauthentication", async () => {
    useStore.setState({ user: makeUser({ role: Role.ISSUER }), isAuthenticated: true });
    mockUseCredential.mockReturnValue({ data: makeCredential({ id: "matched" }) });
    mockMutateAsync.mockResolvedValueOnce(exact);
    renderVerify();
    const user = await verifyFile();
    await user.click(screen.getByRole("button", { name: "View credential details" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Private record matched");
    await act(() => useStore.setState({ user: null, isAuthenticated: false }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(() =>
      useStore.setState({ user: makeUser({ role: Role.ISSUER }), isAuthenticated: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(() => useStore.setState({ user: null, isAuthenticated: false }));
    await user.click(screen.getByRole("button", { name: "View credential details" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Actual School");
  });

  it.each([
    { code: 400404, confirmed: false },
    { code: 400401, confirmed: false },
    { code: 400403, confirmed: false },
    { code: 400404, confirmed: true },
  ])(
    "denies public details for $code / evidence $confirmed even at AI score 1",
    async ({ code, confirmed }) => {
      mockMutateAsync.mockResolvedValueOnce({
        ...exact,
        verdict_code: code,
        exact_match_confirmed: confirmed,
        similarity_score: 1,
      });
      renderVerify();
      await verifyFile();
      expect(
        screen.queryByRole("button", { name: "View credential details" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Actual School")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByText("server text")).not.toBeInTheDocument();
    },
  );
  it.each([400402, 400413, 400410, 400411, 400412])(
    "retains lifecycle warning on result without adding a modal verification strip for %s",
    async (code) => {
      mockMutateAsync.mockResolvedValueOnce({ ...exact, verdict_code: code });
      renderVerify();
      const user = await verifyFile();
      const title = within(screen.getByRole("region", { name: "Verification result" }))
        .getAllByRole("heading", { level: 2 })
        .find((heading) => heading.id !== "verification-result-heading")!.textContent!;
      await user.click(screen.getByRole("button", { name: "View credential details" }));
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByRole("dialog")).not.toHaveTextContent(
        "registry consistency checks passed",
      );
      expect(screen.getByRole("dialog")).toHaveTextContent("Details");
    },
  );

  it.each(["resolve", "reject"])("ignores late %s from replaced upload", async (completion) => {
    let resolveOld!: (value: unknown) => void;
    let rejectOld!: (error: Error) => void;
    mockMutateAsync.mockReturnValueOnce(
      new Promise((resolve, reject) => {
        resolveOld = resolve;
        rejectOld = reject;
      }),
    );
    mockMutateAsync.mockResolvedValueOnce({
      ...exact,
      credential: { ...credential, name: "Replacement record" },
      public_details: { ...exact.public_details, name: "Replacement record" },
    });
    renderVerify();
    const user = await verifyFile();
    await user.click(screen.getByText("Replace"));
    await user.click(screen.getByRole("button", { name: /Verify Document/i }));
    await user.click(screen.getByRole("button", { name: "View credential details" }));
    await act(async () => {
      if (completion === "resolve")
        resolveOld({ ...exact, credential: { ...credential, name: "Old record" } });
      else rejectOld(new Error("Old error"));
    });
    expect(screen.getByRole("dialog")).toHaveTextContent("Replacement record");
    expect(screen.queryByText("Old record")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("ignores completion after pending upload removal", async () => {
    let resolveOld!: (value: unknown) => void;
    mockMutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    renderVerify();
    const user = await verifyFile();
    await user.click(screen.getByText("Remove"));
    await act(async () => resolveOld(exact));
    expect(screen.queryByText("Public Certificate")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Document/i })).toBeDisabled();
  });
  it("retains result on invalid replacement; clears result and details on accepted replacement", async () => {
    mockMutateAsync.mockResolvedValueOnce(exact);
    renderVerify();
    const user = await verifyFile();
    await user.click(screen.getByText("Invalid replacement"));
    expect(screen.getByRole("button", { name: "View credential details" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByText("Replace"));
    expect(screen.queryByText("Public Certificate")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("other.pdf")).toBeInTheDocument();
  });
  it("resets completed verification", async () => {
    mockMutateAsync.mockResolvedValueOnce(exact);
    renderVerify();
    const user = await verifyFile();
    await user.click(screen.getByRole("button", { name: "Verify another document" }));
    expect(screen.queryByText("Public Certificate")).not.toBeInTheDocument();
    expect(screen.getByText("Select file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Document/i })).toBeDisabled();
  });
  it("keeps selected file and retry action after operational error", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Network error"));
    renderVerify();
    await verifyFile();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("test.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry verification" })).toBeEnabled();
    await act(() => i18n.changeLanguage("id"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("Verification failed");
  });
  it("disables verification during request and renders neutral unknown result", async () => {
    let resolve!: (value: unknown) => void;
    mockMutateAsync.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderVerify();
    await verifyFile();
    expect(screen.getByRole("button", { name: "Checking document…" })).toBeDisabled();
    await act(async () => resolve({ verdict_code: 999999, description: "Untrusted server claim" }));
    expect(screen.getByText("Result could not be interpreted")).toBeInTheDocument();
    expect(screen.queryByText("Untrusted server claim")).not.toBeInTheDocument();
  });
});
