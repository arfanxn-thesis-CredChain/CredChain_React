import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { useStore } from "@app/store";
import { VerifyCredential } from "./VerifyCredential";

const mockMutateAsync = vi.fn();

vi.mock("./api/useVerifyCredential", () => ({
  useVerifyCredential: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("./components/CredentialFileInput", () => ({
  CredentialFileInput: ({
    file,
    onChange,
    onExpand,
    error,
  }: {
    file: File | null;
    onChange: (f: File | null) => void;
    onExpand: () => void;
    error?: string;
  }) => (
    <div data-testid="credential-file-input">
      {file ? (
        <div>
          <span data-testid="file-name">{file.name}</span>
          <button onClick={onExpand} aria-label="Preview">
            Preview
          </button>
          <button onClick={() => onChange(null)} aria-label="Remove">
            Remove
          </button>
        </div>
      ) : (
        <div>
          <span>Drag &amp; drop</span>
          <button
            onClick={() => onChange(new File(["test"], "test.pdf", { type: "application/pdf" }))}
          >
            Select file
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  ),
}));

vi.mock("./components/CredentialFileModal", () => ({
  CredentialFileModal: () => null,
}));

function renderVerify(initialEntries?: string[]) {
  return render(<VerifyCredential />, {
    wrapper: ({ children }) => (
      <TestProviders initialEntries={initialEntries ?? ["/credentials/verify"]}>
        {children}
      </TestProviders>
    ),
  });
}

describe("VerifyCredential", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
    useStore.setState({ user: null, isAuthenticated: false });
  });

  it("renders the page heading and description", () => {
    renderVerify();
    expect(screen.getByText("Credential Verification")).toBeInTheDocument();
    expect(
      screen.getByText(/Upload a document to check if it matches the blockchain record/),
    ).toBeInTheDocument();
  });

  it("renders drag-drop zone in empty state", () => {
    renderVerify();
    expect(screen.getByText(/Drag & drop/)).toBeInTheDocument();
    expect(screen.getByText("Select file")).toBeInTheDocument();
  });

  it("renders verify button disabled when no file", () => {
    renderVerify();
    const btn = screen.getByRole("button", { name: /Verify Document/i });
    expect(btn).toBeDisabled();
  });

  it("enables verify button after file is selected", async () => {
    const user = userEvent.setup();
    renderVerify();
    await user.click(screen.getByText("Select file"));
    const btn = screen.getByRole("button", { name: /Verify Document/i });
    expect(btn).toBeEnabled();
  });

  it("shows file name in preview after selection", async () => {
    const user = userEvent.setup();
    renderVerify();
    await user.click(screen.getByText("Select file"));
    expect(screen.getByTestId("file-name")).toHaveTextContent("test.pdf");
  });

  it("calls mutateAsync and shows result on verify click", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({
      verdict_code: 400404,
      similarity_score: 0.92,
      similarity_percent: "92%",
      description: "This document may have been altered.",
      credential: {
        id: "cred-123",
        name: "Test Credential",
        holder_user_id: "user-1",
        issuer_user_id: "user-2",
        holder: null,
        issuer: null,
        revoked_at: null,
        token_id: 1,
        issued_at: "2026-01-01",
      },
    });

    renderVerify();
    await user.click(screen.getByText("Select file"));
    await user.click(screen.getByRole("button", { name: /Verify Document/i }));

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByText("This document may have been altered.")).toBeInTheDocument();
  });

  it("renders expired verdict with date line, org id, number, and disclaimer", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({
      verdict_code: 400413,
      similarity_score: 1,
      similarity_percent: "100%",
      description: "This credential has expired.",
      credential: {
        id: "cred-exp-1",
        name: "Expired Certificate",
        holder_user_id: "user-1",
        issuer_user_id: "user-2",
        issuer_organization_id: "org-123",
        number: "NIP-2026-001",
        revoked_at: null,
        token_id: 1,
        file_hash: "0xabc123",
        issued_at: "2024-01-01T12:00:00Z",
        expires_at: "2025-12-31T12:00:00Z",
        holder: null,
        issuer: null,
      },
    });

    renderVerify();
    await user.click(screen.getByText("Select file"));
    await user.click(screen.getByRole("button", { name: /Verify Document/i }));

    expect(screen.getByText("This credential has expired.")).toBeInTheDocument();
    expect(screen.getByText(/Expired on Dec 31, 2025/)).toBeInTheDocument();
    expect(screen.getByText(/org-123/)).toBeInTheDocument();
    expect(screen.getByText(/NIP-2026-001/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "The credential number has NOT been verified against the issuing organization.",
      ),
    ).toBeInTheDocument();
  });

  it("shows error on verification failure", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error("Network error"));

    renderVerify();
    await user.click(screen.getByText("Select file"));
    await user.click(screen.getByRole("button", { name: /Verify Document/i }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("disables verify button during verification", async () => {
    const user = userEvent.setup();
    let resolveVerify!: (value: unknown) => void;
    mockMutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveVerify = resolve;
      }),
    );

    renderVerify();
    await user.click(screen.getByText("Select file"));
    await user.click(screen.getByRole("button", { name: /Verify Document/i }));

    expect(screen.getByRole("button", { name: /Processing/i })).toBeDisabled();
    resolveVerify({
      verdict_code: 400408,
      similarity_score: null,
      similarity_percent: null,
      description: "Could not read identity data from this document.",
      credential: null,
    });
  });
});
