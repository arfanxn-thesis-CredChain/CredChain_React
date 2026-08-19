import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
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
});
