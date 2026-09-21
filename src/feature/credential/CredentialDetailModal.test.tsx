import { beforeEach, describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { makeCredential } from "@/test/fixtures";
import { server } from "@/test/msw/server";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { CredentialDetailModal } from "./CredentialDetailModal";

function credentialResponse(overrides = {}) {
  const data = makeCredential({
    id: "cred_modal_test",
    name: "Master of Science",
    number: "CRED/2026/0099",
    status: "pending",
    approved_at: null,
    rejected_at: null,
    file_uri: "ipfs://test-hash",
    ...overrides,
  });
  return HttpResponse.json({ code: 400100, message: "Retrieved", data });
}

describe("CredentialDetailModal", () => {
  beforeAll(() => i18n.changeLanguage("id"));
  afterAll(() => i18n.changeLanguage("id"));

  beforeEach(() => {
    useStore.setState({
      user: {
        id: "usr_admin_test",
        name: "Admin User",
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

  const renderModal = (props: Partial<React.ComponentProps<typeof CredentialDetailModal>> = {}) =>
    render(
      <TestProviders>
        <CredentialDetailModal
          credentialId="cred_modal_test"
          open={true}
          onOpenChange={vi.fn()}
          {...props}
        />
      </TestProviders>,
    );

  it("renders file artifact section, name, and status badge", async () => {
    server.use(http.get("*/api/credentials/:id", () => credentialResponse()));
    renderModal();

    expect((await screen.findAllByText("Master of Science")).length).toBeGreaterThan(0);
    expect(await screen.findByText(/menunggu tinjauan/i)).toBeInTheDocument();
  });

  it("renders detail fields with eyebrow labels and values", async () => {
    server.use(http.get("*/api/credentials/:id", () => credentialResponse()));
    renderModal();

    expect(await screen.findByText("CRED/2026/0099")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 3, name: "Detail" })).toBeInTheDocument();
  });

  it("renders all involved user parties with explicit eyebrow headers", async () => {
    server.use(
      http.get("*/api/credentials/:id", () =>
        credentialResponse({
          status: "rejected",
          rejected_at: "2026-05-01T00:00:00Z",
          rejection_reason: "Dokumen buram",
          rejecter_user_id: "usr_rejecter_1",
          rejecter: {
            id: "usr_rejecter_1",
            name: "Prof. Subagyo",
            role: Role.ISSUER,
            email: "subagyo@univ.ac.id",
          },
        }),
      ),
    );
    renderModal();

    expect((await screen.findAllByText(/pemegang/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/ditolak oleh/i)).toBeInTheDocument();
    expect(await screen.findByText("Prof. Subagyo")).toBeInTheDocument();
    expect(await screen.findByText("Dokumen buram")).toBeInTheDocument();
  });

  it("renders unstaged competencies alongside visual indicator", async () => {
    server.use(
      http.get("*/api/credentials/:id", () =>
        credentialResponse({
          competencies: [],
          submitted_competencies: [{ name: "Raw Staged Competency", resolved_id: null }],
        }),
      ),
    );
    renderModal();

    expect(await screen.findByText("Raw Staged Competency")).toBeInTheDocument();
  });

  it("renders read-only system facts at the bottom", async () => {
    server.use(http.get("*/api/credentials/:id", () => credentialResponse()));
    renderModal();

    expect(await screen.findByText(/cred_modal\.\.\.test/)).toBeInTheDocument();
    expect(await screen.findByText(/id kredensial/i)).toBeInTheDocument();
    expect(await screen.findByText(/hash file/i)).toBeInTheDocument();
  });

  it("allows edit mode when pending, disables edit when approved", async () => {
    server.use(
      http.get("*/api/credentials/:id", () =>
        credentialResponse({
          status: "approved",
          approved_at: "2026-02-01T00:00:00Z",
        }),
      ),
    );
    renderModal();

    expect((await screen.findAllByText(/disetujui/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("allows clicking Edit when pending to show inputs", async () => {
    server.use(http.get("*/api/credentials/:id", () => credentialResponse()));
    const user = userEvent.setup();
    renderModal();

    const editBtn = await screen.findByRole("button", { name: "Edit" });
    await user.click(editBtn);

    expect(screen.getByPlaceholderText("Nama kredensial")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan perubahan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batal" })).toBeInTheDocument();
  });
});
