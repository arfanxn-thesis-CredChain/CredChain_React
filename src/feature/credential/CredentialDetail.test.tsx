import { beforeEach, describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { makeCredential } from "@/test/fixtures";
import { server } from "@/test/msw/server";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { CredentialDetail } from "./CredentialDetail";

function pendingCredentialResponse() {
  const pending = makeCredential({
    id: "cred_01HX",
    name: "Bachelor's Degree",
    lifecycle_status: "pending",
    approved_at: null,
    rejected_at: null,
  });
  return HttpResponse.json({ code: 400100, message: "Credential retrieved", data: pending });
}

describe("CredentialDetail", () => {
  beforeAll(() => i18n.changeLanguage("en"));
  afterAll(() => i18n.changeLanguage("id"));

  beforeEach(() => {
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

  const renderPage = () =>
    render(
      <TestProviders initialEntries={["/credentials/cred_01HX"]} routePath="/credentials/:id">
        <CredentialDetail />
      </TestProviders>,
    );

  it("renders the back link", async () => {
    renderPage();
    expect(await screen.findByText("Back")).toBeDefined();
  });

  it("renders the credential name as page title", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Bachelor's Degree" }),
    ).toBeDefined();
  });

  it("renders the credential ID", async () => {
    renderPage();
    expect((await screen.findAllByText(/cred_01HX/)).length).toBeGreaterThan(0);
  });

  it("renders the active status badge", async () => {
    renderPage();
    expect((await screen.findAllByText("Active")).length).toBeGreaterThan(0);
  });

  it("renders the file hash", async () => {
    renderPage();
    expect(await screen.findByText(/0xabcd1234/)).toBeDefined();
  });

  it("renders the holder with full display", async () => {
    renderPage();
    expect(await screen.findByText("John Doe")).toBeDefined();
  });

  it("renders the issuer with full display", async () => {
    renderPage();
    expect(await screen.findByText("University Admin")).toBeDefined();
  });

  it("renders the token ID", async () => {
    renderPage();
    expect(await screen.findByText("123456")).toBeDefined();
  });

  it("shows Approve and Reject actions for a pending credential", async () => {
    server.use(http.get("*/api/credentials/:id", () => pendingCredentialResponse()));
    renderPage();

    expect(await screen.findByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("approves a pending credential with a single-id array", async () => {
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials/:id", () => pendingCredentialResponse()),
      http.post("*/api/credentials/batch/approve", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /approve/i }));

    await waitFor(() => expect(recordedBody).toEqual({ ids: ["cred_01HX"] }));
  });

  it("opens the reject reason modal with a single pending row from the detail", async () => {
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials/:id", () => pendingCredentialResponse()),
      http.post("*/api/credentials/batch/reject", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /reject/i }));
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByText("Reject Credentials")).toBeInTheDocument();

    await user.type(within(dialog).getByRole("textbox"), "Duplicate");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({
        rejections: [{ id: "cred_01HX", reason: "Duplicate" }],
      }),
    );
  });
});
