import { render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { vi } from "vitest";
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
    status: "pending",
    activated_at: null,
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
      language: "en",
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

let activeQueryClient: ReturnType<typeof useQueryClient> | undefined;

function QueryClientCapture() {
  const queryClient = useQueryClient();
  useEffect(() => {
    activeQueryClient = queryClient;
  }, [queryClient]);
  return null;
}

function renderList() {
  activeQueryClient = undefined;
  return render(
    <>
      <QueryClientCapture />
      <CredentialList />
    </>,
    { wrapper: TestProviders },
  );
}

describe("CredentialList", () => {
  it("renders the page header and the default status menu", async () => {
    renderList();
    expect(await screen.findByText("All Credentials")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /status/i })).toBeInTheDocument();
  });

  it("sends activated_at_ and rejected_at_ filters when Pending review is selected", async () => {
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
      expect(filters).toContain("activated_at_");
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
      expect(filters).toContain("activated_at_");
    });

    await user.click(screen.getByRole("button", { name: /pending review/i }));
    await user.click(await screen.findByRole("menuitem", { name: /^failed$/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("activated_at_");
      expect(filters).toContain("rejected_at_");
      expect(filters).toContain("extract_failed_at!_");
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
    const user = userEvent.setup();
    renderList();
    await screen.findByText("All Credentials");

    await user.click(screen.getByRole("button", { name: /status/i }));
    expect(await screen.findByRole("menuitem", { name: /pending review 7/i })).toBeInTheDocument();
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

  it("selects only resolved pending credentials for approval and keeps unresolved detail accessible", async () => {
    const ready = pendingCredential({ id: "cred_ready", name: "Ready Diploma" });
    const unresolved = pendingCredential({
      id: "cred_unresolved",
      name: "Incomplete Diploma",
      unresolved_metadata: ["type", "issuer_organization"],
    });
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(2)
          : credentialsResponse([ready, unresolved]),
      ),
      http.get("*/api/credentials/cred_unresolved", () =>
        HttpResponse.json({ code: 400100, message: "ok", data: unresolved }),
      ),
      http.get("*/api/credentials/cred_unresolved/metadata/suggestions", () =>
        HttpResponse.json({
          code: 401501,
          message: "ok",
          data: { type: null, organization: null, competencies: [] },
        }),
      ),
      http.post("*/api/credentials/batch/approve", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    const cards = await screen.findAllByRole("link", { name: /pending review/i });
    const blocked = cards.find((card) =>
      within(card).queryByRole("button", { name: "Incomplete Diploma" }),
    )!;
    const blockedSelect = within(blocked).getByRole("button", { name: /^Select credential:/ });
    expect(blockedSelect).toBeDisabled();
    expect(
      within(blocked).getByText(/resolve.*credential type.*issuing organization/i),
    ).toBeInTheDocument();
    await user.click(within(blocked).getByRole("button", { name: "Incomplete Diploma" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("button", { name: "Approve (0)" })).toBeDisabled();
    const readyCard = cards.find((card) =>
      within(card).queryByRole("button", { name: "Ready Diploma" }),
    )!;
    await user.click(within(readyCard).getByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Approve (1)" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ready Diploma")).toBeInTheDocument();
    expect(within(dialog).queryByText("Incomplete Diploma")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Confirm Approval" }));
    await waitFor(() => expect(recordedBody).toEqual({ ids: ["cred_ready"] }));
  });

  it("does not restore a selection after its credential disappears and returns", async () => {
    const pending = pendingCredential({ id: "cred_pending_1", name: "Pending Diploma" });
    let visible = [pending];
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(1)
          : credentialsResponse(visible),
      ),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    expect(screen.getByRole("button", { name: "Approve (1)" })).toBeEnabled();

    visible = [];
    await activeQueryClient!.invalidateQueries({ queryKey: ["credentials"] });
    await waitFor(() => expect(screen.queryByText("Pending Diploma")).not.toBeInTheDocument());
    visible = [pending];
    await activeQueryClient!.invalidateQueries({ queryKey: ["credentials"] });
    await screen.findByText("Pending Diploma");

    expect(screen.getByRole("button", { name: "Approve (0)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Select credential:/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("does not reselect a credential when its approval details become valid again", async () => {
    const pending = pendingCredential({ id: "cred_pending_1", name: "Pending Diploma" });
    let current = pending;
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(1)
          : credentialsResponse([current]),
      ),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    expect(screen.getByRole("button", { name: "Approve (1)" })).toBeEnabled();

    current = { ...pending, unresolved_metadata: ["type"] };
    await activeQueryClient!.invalidateQueries({ queryKey: ["credentials"] });
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve (0)" })).toBeDisabled());
    current = pending;
    await activeQueryClient!.invalidateQueries({ queryKey: ["credentials"] });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Select credential:/ })).toBeEnabled(),
    );

    expect(screen.getByRole("button", { name: "Approve (0)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Select credential:/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("confirms one selected pending credential before posting its id", async () => {
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

    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    const selectButtons = await screen.findAllByRole("button", { name: /select credential/i });
    expect(selectButtons.filter((b) => !(b as HTMLButtonElement).disabled)).toHaveLength(1);

    const enabledButton = selectButtons.find((b) => !(b as HTMLButtonElement).disabled)!;
    await user.click(enabledButton);
    await user.click(await screen.findByRole("button", { name: /approve \(1\)/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Approve 1 Credential")).toBeInTheDocument();
    expect(within(dialog).getByText("Pending Diploma")).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(recordedBody).toBeUndefined();

    await user.click(within(dialog).getByRole("button", { name: "Confirm Approval" }));
    await waitFor(() => expect(recordedBody).toEqual({ ids: ["cred_pending_1"] }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: /^approve$/i })[0]).toBeInTheDocument();
  });

  it("shows two selected credentials and keeps selection when confirmation is cancelled", async () => {
    const first = pendingCredential({ id: "cred_pending_1", name: "Pending Diploma" });
    const second = pendingCredential({ id: "cred_pending_2", name: "Training Certificate" });
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(0)
          : credentialsResponse([first, second]),
      ),
      http.post("*/api/credentials/batch/approve", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    renderList();
    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    const selectButtons = await screen.findAllByRole("button", { name: /^Select credential:/ });
    for (const button of selectButtons) await user.click(button);
    await user.click(screen.getByRole("button", { name: "Approve (2)" }));

    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Approve 2 Credentials")).toBeInTheDocument();
    expect(within(dialog).getByText("Pending Diploma")).toBeInTheDocument();
    expect(within(dialog).getByText("Training Certificate")).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(recordedBody).toBeUndefined();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Deselect credential:/ })).toHaveLength(2);
    expect(recordedBody).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Approve (2)" }));
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Confirm Approval" }));
    await waitFor(() =>
      expect(recordedBody).toEqual({ ids: ["cred_pending_1", "cred_pending_2"] }),
    );
  });

  it("stops approval when selected credential becomes unresolved while confirmation is open", async () => {
    const ready = pendingCredential({ id: "cred_ready", name: "Ready Diploma" });
    let current = ready;
    const post = vi.fn();
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(1)
          : credentialsResponse([current]),
      ),
      http.post("*/api/credentials/batch/approve", () => {
        post();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Approve (1)" }));
    const dialog = await screen.findByRole("dialog");
    current = { ...ready, unresolved_metadata: ["issuer_organization"] };
    await activeQueryClient!.invalidateQueries({ queryKey: ["credentials"] });
    await waitFor(() => expect(screen.getByText("Approve (0)").closest("button")).toBeDisabled());
    expect(within(dialog).queryByText("Ready Diploma")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/selection changed/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm Approval" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("does not submit a reduced approval batch when one selected member becomes ineligible", async () => {
    const first = pendingCredential({ id: "cred_first", name: "First Diploma" });
    const second = pendingCredential({ id: "cred_second", name: "Second Diploma" });
    let current = [first, second];
    const post = vi.fn();
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(2)
          : credentialsResponse(current),
      ),
      http.post("*/api/credentials/batch/approve", () => {
        post();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    for (const button of await screen.findAllByRole("button", { name: /^Select credential:/ })) {
      await user.click(button);
    }
    await user.click(screen.getByRole("button", { name: "Approve (2)" }));
    const dialog = await screen.findByRole("dialog");
    current = [first, { ...second, unresolved_metadata: ["type"] }];
    await activeQueryClient!.invalidateQueries({ queryKey: ["credentials"] });
    await waitFor(() => expect(screen.getByText("Approve (1)")).toBeInTheDocument());
    expect(within(dialog).getByText(/selection changed/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm Approval" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
    expect(within(dialog).queryByText("Second Diploma")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Approve (1)" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Approve (1)" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm Approval" }),
    );
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  });

  it("confirms inline card approval before posting", async () => {
    const pending = pendingCredential({ id: "cred_pending_1", name: "Pending Diploma" });
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(0)
          : credentialsResponse([pending]),
      ),
      http.post("*/api/credentials/batch/approve", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    renderList();
    await screen.findByText("Pending Diploma");
    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    await user.click(approveButtons[1]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Approve 1 Credential")).toBeInTheDocument();
    expect(within(dialog).getByText("Pending Diploma")).toBeInTheDocument();
    expect(recordedBody).toBeUndefined();
    await user.click(within(dialog).getByRole("button", { name: "Confirm Approval" }));
    await waitFor(() => expect(recordedBody).toEqual({ ids: ["cred_pending_1"] }));
  });

  it("refreshes loaded credentials after backend rejects stale approval", async () => {
    const ready = pendingCredential({ id: "cred_ready", name: "Ready Diploma" });
    let current = ready;
    let listCalls = 0;
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        if (new URL(request.url).searchParams.get("limit") === "1") return pageResponse(1);
        listCalls++;
        return credentialsResponse([current]);
      }),
      http.post("*/api/credentials/batch/approve", () => {
        current = { ...ready, unresolved_metadata: ["type"] };
        return HttpResponse.json({ code: 401546, message: "Unresolved metadata" }, { status: 422 });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Approve (1)" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm Approval" }),
    );
    await waitFor(() => expect(listCalls).toBeGreaterThan(2));
    await waitFor(() => expect(screen.getByText("Approve (0)").closest("button")).toBeDisabled());
    expect(screen.getByText(/resolve.*credential type/i)).toBeInTheDocument();
  });

  it("keeps approval confirmation and selection open after a failed request", async () => {
    const pending = pendingCredential({ id: "cred_pending_1", name: "Pending Diploma" });
    let requests = 0;
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(0)
          : credentialsResponse([pending]),
      ),
      http.post("*/api/credentials/batch/approve", () => {
        requests++;
        return HttpResponse.json({ code: 400500, message: "Failed" }, { status: 500 });
      }),
    );

    const user = userEvent.setup();
    renderList();
    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Approve (1)" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Confirm Approval" }));

    await waitFor(() => expect(requests).toBe(1));
    expect(within(dialog).getByText("Pending Diploma")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Confirm Approval" })).toBeEnabled(),
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: /^Deselect credential:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve (1)" })).toBeInTheDocument();
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

    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    expect(await screen.findByRole("button", { name: /approve \(0\)/i })).toBeDisabled();
  });

  it("posts inline rejection of unresolved pending credentials with a reason", async () => {
    const unresolved = pendingCredential({
      id: "cred_unresolved_inline",
      name: "Incomplete Diploma",
      unresolved_metadata: ["competency"],
    });
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(1)
          : credentialsResponse([unresolved]),
      ),
      http.post("*/api/credentials/batch/reject", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    renderList();
    const card = await screen.findByRole("link", { name: /pending review/i });
    expect(within(card).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /complete details/i })).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Reject" }));
    await user.type(within(card).getByRole("textbox", { name: /rejection reason/i }), "Invalid");
    await user.click(within(card).getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({
        rejections: [{ id: "cred_unresolved_inline", reason: "Invalid" }],
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows rejecting unresolved pending credentials with reasons", async () => {
    const unresolved = pendingCredential({
      id: "cred_unresolved",
      name: "Incomplete Diploma",
      unresolved_metadata: ["type"],
    });
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(1)
          : credentialsResponse([unresolved]),
      ),
      http.post("*/api/credentials/batch/reject", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Reject (1)" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Incorrect certificate");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() =>
      expect(recordedBody).toEqual({
        rejections: [{ id: "cred_unresolved", reason: "Incorrect certificate" }],
      }),
    );
  });

  it("blocks failed re-extraction without a file before confirmation", async () => {
    const failed = makeCredential({
      id: "cred_no_file",
      name: "Missing File",
      extract_state: "failed",
      file_uri: null,
    });
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(0)
          : credentialsResponse([failed]),
      ),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^re-extract$/i }));
    const select = await screen.findByRole("button", { name: /^Select credential:/ });
    expect(select).toBeDisabled();
    expect(screen.getByRole("button", { name: "Re-extract (0)" })).toBeDisabled();
    expect(screen.getByText(/file unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks rejection if one selected credential leaves pending status while modal is open", async () => {
    const first = pendingCredential({ id: "cred_first", name: "First Diploma" });
    const second = pendingCredential({ id: "cred_second", name: "Second Diploma" });
    let current = [first, second];
    const post = vi.fn();
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(2)
          : credentialsResponse(current),
      ),
      http.post("*/api/credentials/batch/reject", () => {
        post();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    for (const button of await screen.findAllByRole("button", { name: /^Select credential:/ }))
      await user.click(button);
    await user.click(screen.getByRole("button", { name: "Reject (2)" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getAllByRole("textbox")[0], "Invalid");
    await user.click(within(dialog).getByRole("button", { name: /apply same reason to all/i }));
    current = [first, { ...second, status: "approved" }];
    await activeQueryClient!.invalidateQueries({ queryKey: ["credentials"] });
    await waitFor(() => expect(screen.getByText("Reject (1)")).toBeInTheDocument());
    expect(within(dialog).getByText(/selection changed/i)).toBeInTheDocument();
    expect(within(dialog).queryByText("Second Diploma")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("revokes a previously activated expired credential through the reason modal", async () => {
    const expired = makeCredential({
      id: "cred_expired",
      name: "Expired Diploma",
      status: "expired",
      expires_at: "2026-02-01T00:00:00Z",
    });
    let recordedBody: unknown;
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(0)
          : credentialsResponse([expired]),
      ),
      http.post("*/api/credentials/batch/revoke", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 400300, message: "ok", data: [] });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^revoke$/i }));
    const select = await screen.findByRole("button", { name: /^Select credential:/ });
    expect(select).toBeEnabled();
    await user.click(select);
    await user.click(screen.getByRole("button", { name: "Revoke (1)" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Expired Diploma")).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox"), "  Superseded  ");
    await user.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() =>
      expect(recordedBody).toEqual({
        revocations: [{ id: "cred_expired", reason: "Superseded" }],
      }),
    );
  });

  it("keeps an expired credential without activation unavailable for revocation", async () => {
    const expired = makeCredential({
      id: "cred_unactivated_expired",
      name: "Unactivated Expired Diploma",
      status: "expired",
      activated_at: null,
      expires_at: "2026-02-01T00:00:00Z",
    });
    const post = vi.fn();
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(0)
          : credentialsResponse([expired]),
      ),
      http.post("*/api/credentials/batch/revoke", () => {
        post();
        return HttpResponse.json({ code: 400300, message: "ok", data: [] });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^revoke$/i }));
    const select = await screen.findByRole("button", { name: /^Select credential:/ });
    expect(select).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revoke (0)" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("blocks revocation if selected credential changes status while modal is open", async () => {
    const approved = makeCredential({ id: "cred_approved", name: "Approved Diploma" });
    let current = approved;
    const post = vi.fn();
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(0)
          : credentialsResponse([current]),
      ),
      http.post("*/api/credentials/batch/revoke", () => {
        post();
        return HttpResponse.json({ code: 400300, message: "ok", data: [] });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^revoke$/i }));
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Revoke (1)" }));
    const dialog = await screen.findByRole("dialog");
    current = { ...approved, status: "revoked" };
    await activeQueryClient!.invalidateQueries({ queryKey: ["credentials"] });
    await waitFor(() => expect(screen.getByText("Revoke (0)").closest("button")).toBeDisabled());
    expect(within(dialog).getByText(/selection changed/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Revoke" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("refreshes revoked status after backend rejects stale revocation", async () => {
    const approved = makeCredential({ id: "cred_approved", name: "Approved Diploma" });
    let current = approved;
    let listCalls = 0;
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        if (new URL(request.url).searchParams.get("limit") === "1") return pageResponse(0);
        listCalls++;
        return credentialsResponse([current]);
      }),
      http.post("*/api/credentials/batch/revoke", () => {
        current = { ...approved, status: "revoked" };
        return HttpResponse.json({ code: 400344, message: "Not approved" }, { status: 422 });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^revoke$/i }));
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Revoke (1)" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Revoke" }),
    );
    await waitFor(() => expect(listCalls).toBeGreaterThan(2));
    await waitFor(() => expect(screen.getByText("Revoke (0)").closest("button")).toBeDisabled());
  });

  it("rechecks failed extraction after confirmation before posting", async () => {
    const failed = makeCredential({
      id: "cred_failed",
      name: "Failed File",
      extract_state: "failed",
    });
    let current = failed;
    const post = vi.fn();
    server.use(
      http.get("*/api/credentials", ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pageResponse(0)
          : credentialsResponse([current]),
      ),
      http.post("*/api/credentials/batch/reextract", () => {
        post();
        return HttpResponse.json({ code: 400500, message: "ok", data: [] });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^re-extract$/i }));
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Re-extract (1)" }));
    const dialog = await screen.findByRole("alertdialog");
    current = { ...failed, file_uri: null };
    await activeQueryClient!.invalidateQueries({ queryKey: ["credentials"] });
    await waitFor(() =>
      expect(screen.getByText("Re-extract (0)").closest("button")).toBeDisabled(),
    );
    await user.click(within(dialog).getByRole("button", { name: /re-extract/i }));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText("Re-extract (0)")).toBeInTheDocument();
  });

  it("refreshes loaded credentials after backend rejects stale rejection", async () => {
    const pending = pendingCredential({ id: "cred_pending", name: "Pending Diploma" });
    let current = pending;
    let listCalls = 0;
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        if (new URL(request.url).searchParams.get("limit") === "1") return pageResponse(1);
        listCalls++;
        return credentialsResponse([current]);
      }),
      http.post("*/api/credentials/batch/reject", () => {
        current = { ...pending, status: "approved" };
        return HttpResponse.json({ code: 401241, message: "Already approved" }, { status: 409 });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Reject (1)" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Invalid");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(listCalls).toBeGreaterThan(2));
    await waitFor(() => expect(screen.getByText("Reject (0)").closest("button")).toBeDisabled());
    expect(within(dialog).getByText(/selection changed/i)).toBeInTheDocument();
  });

  it("refreshes failed extraction after backend rejects stale re-extraction", async () => {
    const failed = makeCredential({
      id: "cred_failed",
      name: "Failed File",
      extract_state: "failed",
    });
    let current = failed;
    let listCalls = 0;
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        if (new URL(request.url).searchParams.get("limit") === "1") return pageResponse(0);
        listCalls++;
        return credentialsResponse([current]);
      }),
      http.post("*/api/credentials/batch/reextract", () => {
        current = { ...failed, file_uri: null };
        return HttpResponse.json({ code: 400541, message: "Not eligible" }, { status: 409 });
      }),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /^re-extract$/i }));
    await user.click(await screen.findByRole("button", { name: /^Select credential:/ }));
    await user.click(screen.getByRole("button", { name: "Re-extract (1)" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: /re-extract/i }),
    );
    await waitFor(() => expect(listCalls).toBeGreaterThan(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Re-extract (0)" })).toBeDisabled(),
    );
    expect(screen.getByText(/file unavailable/i)).toBeInTheDocument();
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
    const selectButton = await screen.findByRole("button", { name: /select credential/i });
    await user.click(selectButton);
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

  it("requests /users/self/credentials for a holder and keeps the credentials query-key namespace", async () => {
    useStore.setState({
      user: {
        id: "usr_holder_test",
        name: "Test Holder",
        number: null,
        unit_id: null,
        joined_year: null,
        email: "holder@test.com",
        language: "id",
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
    const recorded: string[] = [];
    server.use(
      http.get("*/api/users/self/credentials", ({ request }) => {
        recorded.push(request.url);
        return pageResponse(0);
      }),
    );

    renderList();

    await waitFor(() => expect(listRequestsOf(recorded).length).toBeGreaterThan(0));
    expect(await screen.findByText("My Credentials")).toBeInTheDocument();
    expect(screen.getByText("Your credentials, all in one place.")).toBeInTheDocument();
  });

  it("renders the holder-personalized empty state when no credentials exist", async () => {
    useStore.setState({
      user: {
        id: "usr_holder_test",
        name: "Test Holder",
        number: null,
        unit_id: null,
        joined_year: null,
        email: "holder@test.com",
        language: "id",
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
    server.use(http.get("*/api/users/self/credentials", () => pageResponse(0)));

    renderList();

    expect(await screen.findByText("My Credentials")).toBeInTheDocument();
    expect(await screen.findByText("No credentials yet")).toBeInTheDocument();
    expect(
      screen.getByText("Registered credentials linked to your wallet will appear here."),
    ).toBeInTheDocument();
  });

  it("renders without crashing when lookup reference endpoints omit the data key (empty tables)", async () => {
    server.use(
      http.get("*/api/credential-types", () =>
        HttpResponse.json({ code: 400600, message: "Credential types retrieved" }),
      ),
      http.get("*/api/issuer-organizations", () =>
        HttpResponse.json({ code: 400600, message: "Issuer organizations retrieved" }),
      ),
      http.get("*/api/competencies", () =>
        HttpResponse.json({ code: 400600, message: "Competencies retrieved" }),
      ),
      http.get("*/api/user-units", () =>
        HttpResponse.json({ code: 301000, message: "User units retrieved successfully." }),
      ),
      http.get("*/api/credentials", () => pageResponse(0)),
    );

    renderList();
    expect(await screen.findByText("All Credentials")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /status/i })).toBeInTheDocument();
  });

  it("applies pending review filter when clicking approve action button and reverts on cancel", async () => {
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

    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("activated_at_");
      expect(filters).toContain("rejected_at_");
    });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      const lastRequest = listRequestsOf(recorded).at(-1);
      const filters = lastRequest ? lastRequest.searchParams.getAll("filters") : [];
      expect(filters).not.toContain("activated_at_");
      expect(filters).not.toContain("rejected_at_");
    });
  });

  it("applies approved review filter when clicking revoke action button and reverts on cancel", async () => {
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

    await user.click(screen.getByRole("button", { name: /^revoke$/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("activated_at!_");
      expect(filters).toContain("revoked_at_");
    });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      const lastRequest = listRequestsOf(recorded).at(-1);
      const filters = lastRequest ? lastRequest.searchParams.getAll("filters") : [];
      expect(filters).not.toContain("activated_at!_");
      expect(filters).not.toContain("revoked_at_");
    });
  });

  it("applies failed extraction filter when clicking re-extract action button and reverts on cancel", async () => {
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

    await user.click(screen.getByRole("button", { name: /^re-extract$/i }));

    await waitFor(() => {
      const filters = listRequestsOf(recorded).flatMap((url) => url.searchParams.getAll("filters"));
      expect(filters).toContain("extract_failed_at!_");
    });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      const lastRequest = listRequestsOf(recorded).at(-1);
      const filters = lastRequest ? lastRequest.searchParams.getAll("filters") : [];
      expect(filters).not.toContain("extract_failed_at!_");
    });
  });

  it("opens credential detail modal when credential title is clicked in bulk mode", async () => {
    const pending = pendingCredential({ id: "cred_pending_1", name: "Pending Diploma" });
    server.use(
      http.get("*/api/credentials", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") === "1") return pageResponse(0);
        return credentialsResponse([pending]);
      }),
      http.get("*/api/credentials/cred_pending_1", () => {
        return HttpResponse.json({ code: 400100, message: "ok", data: pending });
      }),
    );

    const user = userEvent.setup();
    renderList();

    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    await user.click(await screen.findByRole("button", { name: "Pending Diploma" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
