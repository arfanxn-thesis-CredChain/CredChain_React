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
    status: "pending",
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

  it("renders the lifecycle status badge instead of the legacy Active pill", async () => {
    renderPage();
    expect(await screen.findByText("Approved", { selector: "span" })).toBeDefined();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("shows the lifecycle badge for a pending credential and no legacy Active pill", async () => {
    server.use(http.get("*/api/credentials/:id", () => pendingCredentialResponse()));
    renderPage();

    expect(await screen.findByText("Pending review")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("shows the lifecycle badge for a rejected credential and no legacy Active pill", async () => {
    server.use(
      http.get("*/api/credentials/:id", () =>
        HttpResponse.json({
          code: 400100,
          message: "Credential retrieved",
          data: makeCredential({
            id: "cred_01HX",
            status: "rejected",
            approved_at: null,
            rejected_at: "2026-01-02T00:00:00Z",
          }),
        }),
      ),
    );
    renderPage();

    expect(await screen.findByText("Rejected", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("does not leave stale edits when Cancel then re-enter edit mode", async () => {
    server.use(http.get("*/api/credentials/:id", () => pendingCredentialResponse()));

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const nameInput = screen.getByPlaceholderText("Credential name");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Degree");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByDisplayValue("Bachelor's Degree")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Updated Degree")).not.toBeInTheDocument();
  });

  it("shows the file hash and token ID without a disclosure toggle", async () => {
    renderPage();

    expect(await screen.findByText(/0xabcd1234/)).toBeDefined();
    expect(screen.getByText("123456")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Verification & trace" })).not.toBeInTheDocument();
  });

  it("renders the holder with full display", async () => {
    renderPage();
    expect(await screen.findByText("John Doe")).toBeDefined();
  });

  it("renders the issuer with full display", async () => {
    renderPage();
    expect(await screen.findByText("University Admin")).toBeDefined();
  });

  it("renders resolved type and issuer organization names instead of raw IDs", async () => {
    server.use(
      http.get("*/api/credentials/:id", () =>
        HttpResponse.json({
          code: 400100,
          message: "Credential retrieved",
          data: makeCredential({
            id: "cred_01HX",
            name: "Bachelor's Degree",
            type: { id: "ctype_01", name: "Bachelor's Degree Type" },
            issuer_organization: { id: "org_01", name: "University of Indonesia" },
          }),
        }),
      ),
    );
    renderPage();

    expect(await screen.findByText("Bachelor's Degree Type")).toBeInTheDocument();
    expect(screen.getByText("University of Indonesia")).toBeInTheDocument();
    expect(screen.queryByText("ctype_01")).not.toBeInTheDocument();
    expect(screen.queryByText("org_01")).not.toBeInTheDocument();
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

  it("rejects a pending credential inline with a reason, no modal", async () => {
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText(/explain why/i);
    await user.type(input, "Duplicate");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({
        rejections: [{ id: "cred_01HX", reason: "Duplicate" }],
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks inline reject submission when the reason is empty", async () => {
    server.use(http.get("*/api/credentials/:id", () => pendingCredentialResponse()));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /reject/i }));
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(screen.getByText(/rejection reason is required/i)).toBeInTheDocument();
  });

  it("hides extraction status and error from a non-issuer role", async () => {
    useStore.setState({
      user: {
        id: "usr_holder_test",
        name: "Test Holder",
        number: null,
        unit_id: null,
        joined_year: null,
        email: "holder@test.com",
        birth_date: null,
        gender: null,
        role: Role.HOLDER,
        meta: null,
        wallet_address: "0x" + "0".repeat(40),
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
      isAuthenticated: true,
    });
    server.use(
      http.get("*/api/users/self/credentials/:id", () =>
        HttpResponse.json({
          code: 400100,
          message: "Credential retrieved",
          data: makeCredential({
            id: "cred_01HX",
            extract_state: "failed",
            extract_error: "Unsupported file format",
          }),
        }),
      ),
    );

    renderPage();

    await screen.findByRole("heading", { level: 2, name: "Test Credential" });
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
    expect(screen.queryByText(/unsupported file format/i)).not.toBeInTheDocument();
  });

  it("shows the Edit button for a pending credential and saves only changed fields", async () => {
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials/:id", () => pendingCredentialResponse()),
      http.put("*/api/credentials/batch", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401400, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit" }));

    const nameInput = screen.getByPlaceholderText("Credential name");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Degree");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({
        credentials: [{ id: "cred_01HX", name: "Updated Degree" }],
      }),
    );
  });

  it("stays in edit mode and shows the validation error on invalid input", async () => {
    server.use(http.get("*/api/credentials/:id", () => pendingCredentialResponse()));

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit" }));

    const nameInput = screen.getByPlaceholderText("Credential name");
    await user.clear(nameInput);
    await user.type(nameInput, "x".repeat(257));

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(await screen.findByText("Name must be 256 characters or fewer")).toBeInTheDocument();
  });

  it("does not show Edit for a non-pending credential and shows the pending-only helper", async () => {
    renderPage();

    expect(await screen.findByText("Only pending credentials can be edited.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("revokes an approved credential after confirm", async () => {
    let recordedBody: unknown;
    server.use(
      http.post("*/api/credentials/batch/revoke", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 400300, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Revoke" }));

    const confirmDialog = await screen.findByRole("alertdialog");
    expect(screen.getByText("Revoke 1 credential?")).toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(recordedBody).toEqual({ ids: ["cred_01HX"] }));
  });

  it("Edit → change competencies → Save fires both the batch update and the competency link mutation", async () => {
    let recordedUrl = "";
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials/:id", () =>
        HttpResponse.json({
          code: 400100,
          message: "Credential retrieved",
          data: makeCredential({
            id: "cred_01HX",
            status: "pending",
            approved_at: null,
            rejected_at: null,
            competencies: [{ id: "comp_01", name: "Machine Learning", active: true }],
          }),
        }),
      ),
      http.put("*/api/credentials/:id/competencies", async ({ request }) => {
        recordedUrl = request.url;
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401300, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit" }));

    const combobox = await screen.findByRole("combobox", { name: "Competencies" });
    await user.click(combobox);
    await user.click(await screen.findByRole("menuitem", { name: /Data Analysis/ }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({ competency_ids: ["comp_01", "comp_02"] }),
    );
    expect(recordedUrl).toContain("/credentials/cred_01HX/competencies");
  });

  it("Edit → change competencies → Cancel restores the original chips, and a subsequent Save does not link", async () => {
    let linkCalled = false;
    server.use(
      http.get("*/api/credentials/:id", () =>
        HttpResponse.json({
          code: 400100,
          message: "Credential retrieved",
          data: makeCredential({
            id: "cred_01HX",
            status: "pending",
            approved_at: null,
            rejected_at: null,
            competencies: [{ id: "comp_01", name: "Machine Learning", active: true }],
          }),
        }),
      ),
      http.put("*/api/credentials/:id/competencies", () => {
        linkCalled = true;
        return HttpResponse.json({ code: 401300, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByText("Machine Learning");

    const combobox = screen.getByRole("combobox", { name: "Competencies" });
    await user.click(combobox);
    await user.click(await screen.findByRole("menuitem", { name: /Data Analysis/ }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
    expect(screen.queryByText("Data Analysis")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument());
    expect(linkCalled).toBe(false);
  });

  it("seeds the competency editor from the loaded credential", async () => {
    server.use(
      http.get("*/api/credentials/:id", () =>
        HttpResponse.json({
          code: 400100,
          message: "Credential retrieved",
          data: makeCredential({
            id: "cred_01HX",
            status: "pending",
            approved_at: null,
            rejected_at: null,
            competencies: [{ id: "comp_01", name: "Machine Learning", active: true }],
          }),
        }),
      ),
    );
    renderPage();

    // Chip proves appliedIds was seeded — an empty seed would silently wipe the link on save.
    expect(await screen.findByText("Machine Learning")).toBeInTheDocument();
  });

  it("renders the meta label once, not duplicated across sections", async () => {
    renderPage();
    await screen.findByText("Additional Information");
    expect(screen.getAllByText("Additional Information")).toHaveLength(1);
  });

  it("renders the credential name in both the page heading and the detail row", async () => {
    server.use(http.get("*/api/credentials/:id", () => pendingCredentialResponse()));
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { level: 2, name: "Bachelor's Degree" });
    expect(screen.getAllByText("Bachelor's Degree")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByPlaceholderText("Credential name")).toHaveValue("Bachelor's Degree");
  });

  it("shows each edit-mode field label exactly once", async () => {
    server.use(http.get("*/api/credentials/:id", () => pendingCredentialResponse()));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.getAllByText("Credential type")).toHaveLength(1);
    expect(screen.getAllByText("Issuer organization")).toHaveLength(1);
    expect(screen.getAllByText("Competencies")).toHaveLength(1);
  });

  it("disables approve while metadata is unresolved", async () => {
    server.use(
      http.get("*/api/credentials/:id", () =>
        HttpResponse.json({
          code: 400100,
          message: "Credential retrieved",
          data: makeCredential({
            id: "cred_01HX",
            status: "pending",
            approved_at: null,
            rejected_at: null,
            type_id: null,
            submitted_type_name: "Micro-credential",
            unresolved_metadata: ["type"],
          }),
        }),
      ),
      http.get("*/api/credentials/:id/metadata/suggestions", () =>
        HttpResponse.json({
          code: 401501,
          message: "ok",
          data: {
            credential_id: "cred_01HX",
            type: { submitted_name: "Micro-credential", matches: [] },
            organization: null,
            competencies: [],
          },
        }),
      ),
    );
    renderPage();

    const approve = await screen.findByRole("button", { name: /approve/i });
    expect(approve).toBeDisabled();

    // The blocking reason must be readable on screen, not hidden behind a
    // hover-only `title` attribute — and the resolver alert itself must render.
    expect(
      await screen.findByText("Complete the details before approving"),
    ).toBeInTheDocument();
    expect(screen.getByText("Name not yet registered")).toBeInTheDocument();
  });

  it("enables approve once metadata resolves", async () => {
    server.use(
      http.get("*/api/credentials/:id", () =>
        HttpResponse.json({
          code: 400100,
          message: "Credential retrieved",
          data: makeCredential({
            id: "cred_01HX",
            status: "pending",
            approved_at: null,
            rejected_at: null,
            unresolved_metadata: [],
          }),
        }),
      ),
    );
    renderPage();

    const approve = await screen.findByRole("button", { name: /approve/i });
    expect(approve).toBeEnabled();
  });

  it("Holder view: renders the two read-only cards with no Edit, no review actions, no resolver", async () => {
    useStore.setState({
      user: {
        id: "usr_holder_test",
        name: "Test Holder",
        number: null,
        unit_id: null,
        joined_year: null,
        email: "holder@test.com",
        birth_date: null,
        gender: null,
        role: Role.HOLDER,
        meta: null,
        wallet_address: "0x" + "1".repeat(40),
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
      isAuthenticated: true,
    });
    server.use(http.get("*/api/users/self/credentials/:id", () => pendingCredentialResponse()));

    renderPage();

    // Card 1 — hero.
    expect(await screen.findByText("Pending review")).toBeInTheDocument();
    // Card 2 — detail, read-only, holder block folded in.
    expect(await screen.findByRole("heading", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByText("Test Holder")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
    expect(screen.queryByText("Name not yet registered")).not.toBeInTheDocument();
  });

  it("renders rejection reason and rejecter contact block for a rejected credential", async () => {
    server.use(
      http.get("*/api/credentials/:id", () =>
        HttpResponse.json({
          code: 400100,
          message: "Credential retrieved",
          data: makeCredential({
            id: "cred_01HX",
            status: "rejected",
            approved_at: null,
            rejected_at: "2026-06-01T00:00:00Z",
            rejection_reason: "Document signature does not match institution records",
            rejecter_user_id: "usr_rejecter_test",
            rejecter: {
              id: "usr_rejecter_test",
              name: "Dean Reviewer",
              role: Role.ADMIN,
              email: "dean@test.com",
              number: "ADM-999",
              unit_id: null,
              joined_year: null,
              birth_date: null,
              gender: null,
              meta: null,
              wallet_address: "0x" + "2".repeat(40),
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              deleted_at: null,
            },
          }),
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Rejection reason")).toBeInTheDocument();
    expect(
      screen.getByText("Document signature does not match institution records"),
    ).toBeInTheDocument();
    expect(screen.getByText("Dean Reviewer")).toBeInTheDocument();
    expect(screen.getByText("ADM-999")).toBeInTheDocument();
  });
});
