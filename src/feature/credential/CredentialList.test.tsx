import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { makeCredential } from "@/test/fixtures";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
import type { CredentialDTO } from "@shared/types/api";
import { CredentialList } from "./CredentialList";

function pageResponse(total: number) {
  return HttpResponse.json({
    code: 400100,
    message: "Credentials retrieved",
    data: {
      items: [],
      total,
      page: 1,
      limit: 50,
      last_page: 1,
      from: 0,
      to: 0,
      first_page_url: null,
      last_page_url: null,
      next_page_url: null,
      prev_page_url: null,
    },
  });
}

function listRequestsOf(recorded: string[]): URL[] {
  return recorded
    .map((url) => new URL(url))
    .filter((url) => url.searchParams.get("limit") === "50");
}

function credentialsResponse(items: CredentialDTO[]) {
  return HttpResponse.json({
    code: 400100,
    message: "Credentials retrieved",
    data: {
      items,
      total: items.length,
      page: 1,
      limit: 50,
      last_page: 1,
      from: 0,
      to: items.length,
      first_page_url: null,
      last_page_url: null,
      next_page_url: null,
      prev_page_url: null,
    },
  });
}

function pendingCredential(overrides: Partial<CredentialDTO> = {}): CredentialDTO {
  return makeCredential({
    lifecycle_status: "pending",
    approved_at: null,
    rejected_at: null,
    ...overrides,
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
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

function renderList() {
  return render(<CredentialList />, { wrapper: TestProviders });
}

describe("CredentialList", () => {
  it("renders the page header and the default status menu", async () => {
    renderList();
    expect(await screen.findByText("All Credentials")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /status/i })).toBeInTheDocument();
  });

  it("sends approved_at_ and rejected_at_ filters when Pending review is selected", async () => {
    const recorded: string[] = [];
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        recorded.push(request.url);
        return pageResponse(0);
      }),
    );
    const user = userEvent.setup();
    renderList();
    await screen.findByText("All Credentials");

    await user.click(screen.getByRole("button", { name: /status/i }));
    await user.click(await screen.findByRole("menuitem", { name: /pending review/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("approved_at_");
      expect(filters).toContain("rejected_at_");
    });
  });

  it("keeps the review filter when an extraction option is selected", async () => {
    const recorded: string[] = [];
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        recorded.push(request.url);
        return pageResponse(0);
      }),
    );
    const user = userEvent.setup();
    renderList();
    await screen.findByText("All Credentials");

    await user.click(screen.getByRole("button", { name: /status/i }));
    await user.click(await screen.findByRole("menuitem", { name: /pending review/i }));
    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("approved_at_");
    });

    await user.click(screen.getByRole("button", { name: /pending review/i }));
    await user.click(await screen.findByRole("menuitem", { name: /^failed$/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("approved_at_");
      expect(filters).toContain("rejected_at_");
      expect(filters).toContain("extract_status=failed");
    });
  });

  it("renders the pending count badge from the limit:1 query total", async () => {
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") === "1") {
          return pageResponse(7);
        }
        return pageResponse(0);
      }),
    );
    renderList();

    expect(await screen.findByText("7")).toBeInTheDocument();
  });

  it("emits the type_id filter when a type is selected", async () => {
    const recorded: string[] = [];
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        recorded.push(request.url);
        return pageResponse(0);
      }),
    );
    const user = userEvent.setup();
    renderList();
    await screen.findByText("All Credentials");

    await user.click(screen.getByRole("button", { name: /type:/i }));
    await user.click(await screen.findByRole("menuitem", { name: /bachelor's degree/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("type_id=ctype_01");
    });
  });

  it("emits the issuer_organization_id filter when an organization is selected", async () => {
    const recorded: string[] = [];
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        recorded.push(request.url);
        return pageResponse(0);
      }),
    );
    const user = userEvent.setup();
    renderList();
    await screen.findByText("All Credentials");

    await user.click(screen.getByRole("button", { name: /organization:/i }));
    await user.click(await screen.findByRole("menuitem", { name: /university of indonesia/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("issuer_organization_id=iorg_01");
    });
  });

  it("emits the competency_id filter when a competency is selected", async () => {
    const recorded: string[] = [];
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        recorded.push(request.url);
        return pageResponse(0);
      }),
    );
    const user = userEvent.setup();
    renderList();
    await screen.findByText("All Credentials");

    await user.click(screen.getByRole("button", { name: /competency:/i }));
    await user.click(await screen.findByRole("menuitem", { name: /machine learning/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("competency_id=comp_01");
    });
  });

  it("emits the holder_unit_id filter when a holder unit is selected", async () => {
    const recorded: string[] = [];
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        recorded.push(request.url);
        return pageResponse(0);
      }),
    );
    const user = userEvent.setup();
    renderList();
    await screen.findByText("All Credentials");

    await user.click(screen.getByRole("button", { name: /unit:/i }));
    await user.click(await screen.findByRole("menuitem", { name: /faculty of engineering/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("holder_unit_id=unit_01");
    });
  });

  it("adjusts the sort to revoked_at when the revoked review filter is active", async () => {
    const recorded: string[] = [];
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        recorded.push(request.url);
        return pageResponse(0);
      }),
    );
    const user = userEvent.setup();
    renderList();
    await screen.findByText("All Credentials");

    await user.click(screen.getByRole("button", { name: /status/i }));
    await user.click(await screen.findByRole("menuitem", { name: /^revoked$/i }));

    await waitFor(() => {
      const requests = listRequestsOf(recorded);
      expect(
        requests.some(
          (url) =>
            url.searchParams.getAll("sorts").includes("-revoked_at") &&
            url.searchParams.getAll("filters").includes("revoked_at!_"),
        ),
      ).toBe(true);
    });
  });

  it("shows Approve for a selected pending credential and posts its id", async () => {
    const pending = pendingCredential({ id: "cred_pending_1", name: "Pending Diploma" });
    const approved = makeCredential({ id: "cred_approved_1", name: "Approved Diploma" });
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") === "1") return pageResponse(0);
        return credentialsResponse([pending, approved]);
      }),
      http.post("*/api/credentials/batch/approve", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole("button", { name: /^approve$/i }));
    await user.click(await screen.findByText("Pending Diploma"));

    const selectButtons = screen.getAllByRole("button", { name: /select credential/i });
    expect(selectButtons.filter((b) => !(b as HTMLButtonElement).disabled)).toHaveLength(1);

    const approveSelected = await screen.findByRole("button", { name: /approve \(1\)/i });
    await user.click(approveSelected);

    await waitFor(() => expect(recordedBody).toEqual({ ids: ["cred_pending_1"] }));
  });

  it("leaves the approve action disabled until a pending credential is selected", async () => {
    const pending = pendingCredential({ id: "cred_pending_1", name: "Pending Diploma" });
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") === "1") return pageResponse(0);
        return credentialsResponse([pending]);
      }),
    );

    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole("button", { name: /^approve$/i }));
    expect(await screen.findByRole("button", { name: /approve \(0\)/i })).toBeDisabled();
  });

  it("opens the reject reason modal from the bulk toolbar and posts the rejections", async () => {
    const pending = pendingCredential({ id: "cred_pending_1", name: "Pending Diploma" });
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") === "1") return pageResponse(0);
        return credentialsResponse([pending]);
      }),
      http.post("*/api/credentials/batch/reject", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole("button", { name: /^reject$/i }));
    await user.click(await screen.findByText("Pending Diploma"));
    await user.click(await screen.findByRole("button", { name: /reject \(1\)/i }));

    const dialog = await screen.findByRole("dialog");
    expect(screen.getByText("Reject Credentials")).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox"), "Missing document");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({
        rejections: [{ id: "cred_pending_1", reason: "Missing document" }],
      }),
    );
    expect(dialog).toBeDefined();
  });
});
