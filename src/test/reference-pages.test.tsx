import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@app/store";
import { CredentialTypesPage } from "@feature/credential-type/CredentialTypesPage";
import { IssuerOrganizationsPage } from "@feature/issuer-organization/IssuerOrganizationsPage";
import { CompetenciesPage } from "@feature/competency/CompetenciesPage";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { makeUser } from "./fixtures";
import { TestProviders } from "./TestProviders";
import { server } from "./msw/server";

const rows = [
  { id: "active", name: "Approved active", status: "approved", active: true },
  { id: "inactive", name: "Approved inactive", status: "approved", active: false },
  { id: "pending", name: "Awaiting review", status: "pending", active: false },
  {
    id: "rejected",
    name: "Rejected proposal",
    status: "rejected",
    active: false,
    rejection_reason: "Duplicate entry",
  },
];

function filteredRows(url: URL, items = rows) {
  const filters = url.searchParams.getAll("filters");
  return items.filter((row) =>
    filters.every((filter) => {
      if (filter.startsWith("status=")) return row.status === filter.slice(7);
      if (filter === "active=true") return row.active;
      if (filter === "active=false") return !row.active;
      return true;
    }),
  );
}

function response(items = rows) {
  return HttpResponse.json({
    code: 400600,
    message: "ok",
    data: {
      items,
      total: items.length,
      page: 1,
      limit: 100,
      last_page: 1,
    },
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  useStore.setState({ user: makeUser({ role: Role.ADMIN }), isAuthenticated: true });
});

const pages = [
  {
    Page: CredentialTypesPage,
    path: "credential-types",
    add: "Add type",
    placeholder: "Type name",
  },
  {
    Page: IssuerOrganizationsPage,
    path: "issuer-organizations",
    add: "Add organization",
    placeholder: "Organization name",
  },
  {
    Page: CompetenciesPage,
    path: "competencies",
    add: "Add competency",
    placeholder: "Competency name",
  },
];

describe.each(pages)("$path reference refinements", ({ Page, path, add, placeholder }) => {
  let navigateTo: NavigateFunction;
  function mount(initialEntries = ["/"]) {
    let queryClient!: QueryClient;
    function CaptureClient() {
      queryClient = useQueryClient();
      navigateTo = useNavigate();
      const location = useLocation();
      return <output data-testid="location">{location.search}</output>;
    }
    return {
      ...render(
        <TestProviders initialEntries={initialEntries}>
          <CaptureClient />
          <Page />
        </TestProviders>,
      ),
      getClient: () => queryClient,
    };
  }

  beforeEach(() => {
    server.use(
      http.get(`*/api/${path}`, ({ request }) => response(filteredRows(new URL(request.url)))),
    );
  });

  async function selectStatus(label: string) {
    const user = userEvent.setup();
    await user.click(
      within(screen.getByRole("group", { name: "Status" })).getByRole("button", {
        name: new RegExp(`^${label}(?:$| )`),
      }),
    );
  }

  it("defaults to approved active references with the shared status pill", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`*/api/${path}`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") !== "1") requests.push(url);
        return response(filteredRows(url));
      }),
    );
    mount();
    await screen.findByText("Approved active");
    expect(requests[0].searchParams.getAll("filters")).toEqual(["status=approved", "active=true"]);
    const active = screen.getByRole("button", { name: "Active" });
    expect(active).toHaveClass("rounded-xl", "h-9", "text-xs");
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByText("Awaiting review")).not.toBeInTheDocument();
    expect(screen.queryByText("Approved inactive")).not.toBeInTheDocument();
    await selectStatus("All");
    await screen.findByText("Awaiting review");
    expect(requests.at(-1)?.searchParams.getAll("filters")).toEqual([]);
    await selectStatus("Pending review");
    await screen.findByText("Awaiting review");
    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.getAll("filters")).toEqual(["status=pending"]),
    );
    await selectStatus("Rejected");
    await screen.findByText("Rejected proposal");
    expect(requests.at(-1)?.searchParams.getAll("filters")).toEqual(["status=rejected"]);
  });

  it("reads URL status, preserves search and unrelated params, and restores history", async () => {
    const user = userEvent.setup();
    mount(["/?status=pending&search=Awaiting&keep=yes"]);
    await screen.findByText("Awaiting review");
    expect(screen.getByRole("button", { name: /^Pending review/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await selectStatus("All");
    expect(screen.getByTestId("location")).toHaveTextContent("status=all&search=Awaiting&keep=yes");
    await act(async () => {
      await navigateTo(-1);
    });
    expect(screen.getByRole("button", { name: /^Pending review/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await act(async () => {
      await navigateTo(1);
    });
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "Next");
    await selectStatus("Active");
    const params = new URLSearchParams(screen.getByTestId("location").textContent!);
    expect(params.get("search")).toBe("Next");
    expect(params.get("keep")).toBe("yes");
    expect(screen.getByTestId("location")).not.toHaveTextContent("status=");
    await act(async () => {
      await navigateTo("/?status=rejected&search=Restored&keep=yes");
    });
    expect(screen.getByRole("searchbox")).toHaveValue("Restored");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Rejected" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });

  it.each(["invalid", "active", "inactive"])(
    "normalizes Holder URL status %s to Active",
    async (status) => {
      useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
      const requests: URL[] = [];
      server.use(
        http.get(`*/api/${path}`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("limit") !== "1") requests.push(url);
          return response(filteredRows(url));
        }),
      );
      mount([`/?status=${status}&keep=yes`]);
      await screen.findByText("Approved active");
      expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByTestId("location")).toHaveTextContent("?keep=yes");
      expect(
        requests.every((url) => url.searchParams.getAll("filters").includes("active=true")),
      ).toBe(true);
    },
  );

  it("removes the status column and approved badges", async () => {
    mount();
    await screen.findByText("Approved active");
    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).queryByText("Approved", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("puts a dashed-circle pending indicator beside a readable name", async () => {
    mount();
    await selectStatus("All");
    const name = await screen.findByText("Awaiting review");
    expect(name).not.toHaveClass("line-through");
    const cell = name.closest("td")!;
    const indicator = within(cell).getByTitle("Pending");
    expect(indicator.querySelector("svg")).toHaveClass("lucide-circle-dashed");
    expect(indicator).toHaveTextContent("Pending");
    expect(cell.querySelector("svg")?.compareDocumentPosition(name)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("uses red without strikethrough for rejected names, reserving strikethrough for approved inactive names", async () => {
    mount();
    await selectStatus("All");
    const rejected = await screen.findByText("Rejected proposal");
    expect(rejected).toHaveClass("text-error");
    expect(rejected).not.toHaveClass("line-through");
    expect(within(rejected.closest("td")!).getByText("Rejected")).toHaveClass("sr-only");
    expect(screen.getByText(/Duplicate entry/)).toHaveClass("text-error");
    expect(screen.getByText("Approved inactive")).toHaveClass("line-through", "opacity-60");
    expect(screen.getByText("Approved active")).not.toHaveClass("line-through");
  });

  it("uses accessible icon-only review actions and keeps rejection reason required", async () => {
    let body: unknown;
    server.use(
      http.post(`*/api/${path}/pending/reject`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ code: 400806, message: "ok", data: null });
      }),
    );
    const user = userEvent.setup();
    mount();
    await selectStatus("All");
    await screen.findByText("Awaiting review");
    for (const label of ["Approve", "Reject"]) {
      const button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("title", label);
      expect(button).toHaveClass("h-11", "w-11");
      expect(button.textContent).toBe("");
    }
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const cell = screen.getByText("Awaiting review").closest("td")!;
    await user.click(within(cell).getByRole("button", { name: "Reject" }));
    expect(body).toBeUndefined();
    await user.type(within(cell).getByRole("textbox"), "  Duplicate entry  ");
    await user.click(within(cell).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(body).toEqual({ rejection_reason: "Duplicate entry" }));
  });

  it("places compact rejection beside the name in one spanning responsive cell", async () => {
    const user = userEvent.setup();
    mount();
    await selectStatus("Pending review");
    const name = await screen.findByText("Awaiting review");
    const row = name.closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Reject" }));
    const reason = within(row).getByRole("textbox");
    expect(reason.tagName).toBe("INPUT");
    expect(row.querySelectorAll("td")).toHaveLength(1);
    expect(reason.closest("td")).toHaveAttribute("colspan", "2");
    expect(screen.getByText("Awaiting review").closest("td")).toContainElement(reason);
    expect(reason.closest("form")?.parentElement).toHaveClass("lg:flex-row");
  });

  it("requires named approval confirmation and cancels without a request", async () => {
    let calls = 0;
    server.use(
      http.post(`*/api/${path}/pending/approve`, () => {
        calls += 1;
        return HttpResponse.json({ code: 400600, message: "ok", data: null });
      }),
    );
    const user = userEvent.setup();
    mount();
    await selectStatus("Pending review");
    await screen.findByText("Awaiting review");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Awaiting review");
    expect(calls).toBe(0);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(calls).toBe(0);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.dblClick(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => expect(calls).toBe(1));
  });

  it.each(["account", "permission", "target", "filter", "search"])(
    "dismisses stale approval after %s changes",
    async (change) => {
      let items = rows;
      let calls = 0;
      server.use(
        http.get(`*/api/${path}`, ({ request }) =>
          response(filteredRows(new URL(request.url), items)),
        ),
        http.post(`*/api/${path}/pending/approve`, () => {
          calls += 1;
          return HttpResponse.json({ code: 400600, message: "ok", data: null });
        }),
      );
      const user = userEvent.setup();
      const { getClient } = mount();
      await selectStatus("Pending review");
      await screen.findByText("Awaiting review");
      await user.click(screen.getByRole("button", { name: "Approve" }));
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      if (change === "account")
        act(() => useStore.setState({ user: makeUser({ id: "other", role: Role.ADMIN }) }));
      if (change === "permission")
        act(() => useStore.setState({ user: makeUser({ role: Role.HOLDER }) }));
      if (change === "target") {
        items = [];
        await act(async () => {
          await getClient().invalidateQueries();
        });
      }
      if (change === "filter") {
        // History/URL changes can happen while the modal is open.
        await act(async () => {
          await navigateTo("/?status=active");
        });
      }
      if (change === "search") {
        await act(async () => {
          await navigateTo("/?status=pending&search=other");
        });
      }
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(calls).toBe(0);
    },
  );

  it("cancels inline drafts and clears them across row and account changes", async () => {
    const second = { ...rows[2], id: "pending-2", name: "Second request" };
    server.use(
      http.get(`*/api/${path}`, ({ request }) =>
        response(filteredRows(new URL(request.url), [...rows, second])),
      ),
    );
    const user = userEvent.setup();
    mount();
    await selectStatus("Pending review");
    await screen.findByText("Awaiting review");
    const firstRow = () => screen.getByText("Awaiting review").closest("tr")!;
    await user.click(within(firstRow()).getByRole("button", { name: "Reject" }));
    await user.type(screen.getByRole("textbox"), "Discard this");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(within(firstRow()).getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    await user.type(screen.getByRole("textbox"), "First draft");
    await user.click(
      within(screen.getByText("Second request").closest("tr")!).getByRole("button", {
        name: "Reject",
      }),
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
    await user.type(screen.getByRole("textbox"), "Second draft");
    act(() => useStore.setState({ user: makeUser({ id: "other-admin", role: Role.ADMIN }) }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    await screen.findByText("Second request");
    await user.click(
      within(screen.getByText("Second request").closest("tr")!).getByRole("button", {
        name: "Reject",
      }),
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps rejection draft after failure and closes after successful retry", async () => {
    let calls = 0;
    let rejected = false;
    server.use(
      http.get(`*/api/${path}`, ({ request }) =>
        response(
          filteredRows(
            new URL(request.url),
            rejected ? rows.filter((row) => row.id !== "pending") : rows,
          ),
        ),
      ),
      http.post(`*/api/${path}/pending/reject`, () => {
        calls += 1;
        if (calls === 1)
          return HttpResponse.json({ code: 100000, message: "failed" }, { status: 500 });
        rejected = true;
        return HttpResponse.json({ code: 400806, message: "ok", data: null });
      }),
    );
    const user = userEvent.setup();
    mount();
    await selectStatus("Pending review");
    await screen.findByText("Awaiting review");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(screen.getByRole("textbox"), "Duplicate entry");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Duplicate entry");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText("Awaiting review")).not.toBeInTheDocument());
    expect(calls).toBe(2);
  });

  it("blocks rejection cancellation and duplicate submission while pending", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let calls = 0;
    server.use(
      http.post(`*/api/${path}/pending/reject`, async () => {
        calls += 1;
        await pending;
        return HttpResponse.json({ code: 400806, message: "ok", data: null });
      }),
    );
    const user = userEvent.setup();
    mount();
    await selectStatus("Pending review");
    await screen.findByText("Awaiting review");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(screen.getByRole("textbox"), "Reason");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(calls).toBe(1));
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(calls).toBe(1);
    finish();
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it("clears rejection when search, filter or review permission changes", async () => {
    const user = userEvent.setup();
    mount();
    await selectStatus("All");
    await screen.findByText("Awaiting review");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await selectStatus("Pending review");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await screen.findByText("Awaiting review");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(screen.getByRole("searchbox"), "Awaiting");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    act(() => useStore.setState({ user: makeUser({ role: Role.HOLDER }) }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("prevents switching editors while a rename is pending", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    server.use(
      http.put(`*/api/${path}/active`, async () => {
        await pending;
        return HttpResponse.json({ code: 400600, message: "ok", data: rows[0] });
      }),
    );
    const user = userEvent.setup();
    mount();
    await selectStatus("All");
    await screen.findByText("Approved active");
    await user.click(
      within(screen.getByText("Approved active").closest("tr")!).getByRole("button", {
        name: "Edit",
      }),
    );
    await user.type(screen.getByRole("textbox"), " updated");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(
      within(screen.getByText("Approved inactive").closest("tr")!).getByRole("button", {
        name: "Edit",
      }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    finish();
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it.each(["rename", "reject"])(
    "clears a %s editor when its target disappears and does not revive it",
    async (mode) => {
      let items = rows;
      server.use(
        http.get(`*/api/${path}`, ({ request }) =>
          response(filteredRows(new URL(request.url), items)),
        ),
      );
      const user = userEvent.setup();
      const { getClient } = mount();
      await selectStatus("All");
      const name = mode === "rename" ? "Approved active" : "Awaiting review";
      const target = await screen.findByText(name);
      await user.click(
        within(target.closest("tr")!).getByRole("button", {
          name: mode === "rename" ? "Edit" : "Reject",
        }),
      );
      items = rows.filter((row) => row.name !== name);
      await act(async () => {
        await getClient().invalidateQueries();
      });
      await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
      items = rows;
      await act(async () => {
        await getClient().invalidateQueries();
      });
      await screen.findByText(name);
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    },
  );

  it("ignores a late rejection error after account context changes", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    server.use(
      http.post(`*/api/${path}/pending/reject`, async () => {
        await pending;
        return HttpResponse.json({ code: 100000, message: "failed" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    mount();
    await selectStatus("Pending review");
    await screen.findByText("Awaiting review");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(screen.getByRole("textbox"), "Old account draft");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toBeDisabled());
    act(() => useStore.setState({ user: makeUser({ id: "other-admin", role: Role.ADMIN }) }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    await screen.findByText("Awaiting review");
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("removes deactivated references from the default Active list", async () => {
    let active = true;
    server.use(
      http.get(`*/api/${path}`, ({ request }) =>
        response(filteredRows(new URL(request.url), [{ ...rows[0], active }])),
      ),
      http.put(`*/api/${path}/active`, () => {
        active = false;
        return HttpResponse.json({ code: 400600, message: "ok", data: { ...rows[0], active } });
      }),
    );
    const user = userEvent.setup();
    mount();
    await screen.findByText("Approved active");
    await user.click(screen.getByRole("switch"));
    await waitFor(() => expect(screen.queryByText("Approved active")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true");
  });

  it.each([Role.ADMIN, Role.HOLDER])(
    "keeps search then status buttons above creation when collapsed, expanded and cancelled for %s",
    async (role) => {
      useStore.setState({ user: makeUser({ role }) });
      const user = userEvent.setup();
      mount();
      await screen.findByText("Approved active");
      const filter = screen.getByRole("button", { name: "Active" });
      const triggerName = role === Role.ADMIN ? add : /^Request New/;
      const trigger = screen.getByRole("button", { name: triggerName });
      expect(filter).toHaveClass("h-9", "rounded-xl", "text-xs");
      expect(trigger).toHaveClass("h-9", "rounded-xl");
      const statusWrapper = screen.getByRole("group", { name: "Status" });
      const toolbar = statusWrapper.parentElement!;
      const creationWrapper = trigger.parentElement!;
      expect(toolbar).toHaveClass("space-y-4");
      expect(toolbar.firstElementChild).toContainElement(screen.getByRole("searchbox"));
      expect(toolbar.firstElementChild?.nextElementSibling).toBe(statusWrapper);
      expect(statusWrapper).toHaveClass("gap-2", "flex-wrap");
      expect(statusWrapper.nextElementSibling).toBe(creationWrapper);
      expect(creationWrapper).toHaveClass("min-w-0", "w-full", "max-w-full");
      expect(creationWrapper).not.toHaveClass("lg:w-fit");
      await user.click(trigger);
      const input = screen.getByPlaceholderText(placeholder);
      expect(input).toHaveClass("h-9");
      expect(input.closest("form")).toHaveClass("flex-row", "flex-wrap");
      expect(input.parentElement?.parentElement).toHaveClass(
        "w-full",
        "max-w-full",
        "flex-none",
        "sm:max-w-full",
        "md:w-md",
      );
      expect(creationWrapper).toContainElement(input);
      expect(statusWrapper.nextElementSibling).toBe(creationWrapper);
      const cancel = screen.getByRole("button", { name: "Cancel" });
      expect(cancel).toHaveClass("h-9", "rounded-xl");
      await user.click(cancel);
      expect(creationWrapper).toContainElement(screen.getByRole("button", { name: triggerName }));
      expect(statusWrapper.nextElementSibling).toBe(creationWrapper);
      expect(screen.queryByPlaceholderText(placeholder)).not.toBeInTheDocument();
    },
  );

  it.each([Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN])(
    "offers server-side approved/inactive filtering for %s while retaining search",
    async (role) => {
      useStore.setState({ user: makeUser({ role }) });
      const requests: URL[] = [];
      server.use(
        http.get(`*/api/${path}`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("limit") !== "1") requests.push(url);
          const filters = url.searchParams.getAll("filters");
          return response(
            rows.filter(
              (row) =>
                (!filters.includes("status=approved") || row.status === "approved") &&
                (!filters.includes("active=false") || !row.active) &&
                (!filters.includes("active=true") || row.active),
            ),
          );
        }),
      );
      mount(["/?search=Approved"]);
      await screen.findByText("Approved active");
      expect(screen.getByRole("searchbox")).toHaveValue("Approved");
      await waitFor(() => expect(requests.at(-1)?.searchParams.get("search")).toBe("Approved"));
      await selectStatus("Inactive");
      await waitFor(() =>
        expect(requests.at(-1)?.searchParams.getAll("filters")).toEqual([
          "status=approved",
          "active=false",
        ]),
      );
      expect(requests.at(-1)?.searchParams.get("search")).toBe("Approved");
      await waitFor(() => expect(screen.queryByText("Awaiting review")).not.toBeInTheDocument());
      expect(screen.queryByText("Rejected proposal")).not.toBeInTheDocument();
      expect(screen.queryByText("Approved active")).not.toBeInTheDocument();
      expect(screen.getByText("Approved inactive")).toBeInTheDocument();
      if (role === Role.ISSUER) {
        expect(screen.queryByRole("switch")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
      }
      await selectStatus("Approved");
      await waitFor(() =>
        expect(requests.at(-1)?.searchParams.getAll("filters")).toEqual(["status=approved"]),
      );
      expect(await screen.findByText("Approved active")).toBeInTheDocument();
    },
  );

  it("keeps Active filters when deactivating a reference after loading another page", async () => {
    let deactivated = false;
    const requests: URL[] = [];
    server.use(
      http.get(`*/api/${path}`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") !== "1") requests.push(url);
        const page = Number(url.searchParams.get("page") ?? 1);
        const items =
          page === 1
            ? deactivated
              ? []
              : [rows[0]]
            : [{ ...rows[0], id: "second", name: "Second active" }];
        return HttpResponse.json({
          code: 400600,
          message: "ok",
          data: {
            items,
            total: deactivated ? 1 : 2,
            page,
            limit: 100,
            last_page: 2,
          },
        });
      }),
      http.put(`*/api/${path}/active`, () => {
        deactivated = true;
        return HttpResponse.json({
          code: 400600,
          message: "ok",
          data: { ...rows[0], active: false },
        });
      }),
    );
    const user = userEvent.setup();
    mount();
    await screen.findByText("Approved active");
    await user.click(screen.getByRole("button", { name: /Load more/i }));
    await screen.findByText("Second active");
    await user.click(
      within(screen.getByText("Approved active").closest("tr")!).getByRole("switch"),
    );
    await waitFor(() => expect(screen.queryByText("Approved active")).not.toBeInTheDocument());
    expect(screen.getByText("Second active")).toBeInTheDocument();
    expect(
      requests.every(
        (url) =>
          JSON.stringify(url.searchParams.getAll("filters")) ===
          JSON.stringify(["status=approved", "active=true"]),
      ),
    ).toBe(true);
  });

  it("removes an activated inactive row after loading another page", async () => {
    let activated = false;
    server.use(
      http.get(`*/api/${path}`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? 1);
        const inactive = url.searchParams.getAll("filters").includes("active=false");
        const items = inactive
          ? page === 1
            ? activated
              ? []
              : [rows[1]]
            : [{ ...rows[1], id: "second", name: "Second inactive" }]
          : rows;
        return HttpResponse.json({
          code: 400600,
          message: "ok",
          data: {
            items,
            total: activated ? 1 : 2,
            page,
            limit: 100,
            last_page: 2,
          },
        });
      }),
      http.put(`*/api/${path}/inactive`, () => {
        activated = true;
        return HttpResponse.json({
          code: 400600,
          message: "ok",
          data: { ...rows[1], active: true },
        });
      }),
    );
    const user = userEvent.setup();
    mount();
    await screen.findByText("Approved active");
    await selectStatus("Inactive");
    await waitFor(() => expect(screen.queryByText("Approved active")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Load more/i }));
    await screen.findByText("Second inactive");
    await user.click(
      within(screen.getByText("Approved inactive").closest("tr")!).getByRole("switch"),
    );
    await waitFor(() => expect(activated).toBe(true));
    await waitFor(() => expect(screen.queryByText("Approved inactive")).not.toBeInTheDocument());
  });

  it("does not reuse another account's fresh reference cache", async () => {
    let calls = 0;
    server.use(
      http.get(`*/api/${path}`, async ({ request }) => {
        if (new URL(request.url).searchParams.get("limit") === "1") return response([rows[2]]);
        calls += 1;
        if (calls > 1) await new Promise((resolve) => setTimeout(resolve, 100));
        return response(calls === 1 ? [rows[1]] : [rows[0]]);
      }),
    );
    mount();
    await screen.findByText("Approved inactive");
    act(() => useStore.setState({ user: makeUser({ id: "other-holder", role: Role.HOLDER }) }));
    await waitFor(() => expect(screen.queryByText("Approved inactive")).not.toBeInTheDocument());
    expect(await screen.findByText("Approved active")).toBeInTheDocument();
    expect(calls).toBeGreaterThan(1);
  });

  it("hides inactive and review actions from holders, including after a role change", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`*/api/${path}`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") !== "1") requests.push(url);
        return response();
      }),
    );
    mount();
    await screen.findByText("Approved active");
    await selectStatus("Inactive");
    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.getAll("filters")).toContain("active=false"),
    );
    act(() => useStore.setState({ user: makeUser({ id: "holder", role: Role.HOLDER }) }));
    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.getAll("filters")).toEqual([
        "status=approved",
        "active=true",
      ]),
    );
    expect(screen.queryByRole("button", { name: "Inactive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("renders holder collection with approved active and own pending or rejected items, excluding inactive", async () => {
    const holderId = "holder-user-1";
    useStore.setState({ user: makeUser({ id: holderId, role: Role.HOLDER }) });

    const holderRows = [
      { id: "active-1", name: "Approved Active Reference", status: "approved", active: true },
      { id: "pending-1", name: "My Pending Request", status: "pending", active: false },
      {
        id: "rejected-1",
        name: "My Rejected Request",
        status: "rejected",
        active: false,
        rejection_reason: "Needs more info",
      },
    ];

    server.use(
      http.get(`*/api/${path}`, ({ request }) =>
        response(filteredRows(new URL(request.url), holderRows)),
      ),
    );

    mount();

    expect(await screen.findByText("Approved Active Reference")).toBeInTheDocument();
    expect(screen.queryByText("My Pending Request")).not.toBeInTheDocument();
    await selectStatus("All");
    await screen.findByText("My Pending Request");
    expect(screen.getByText("My Pending Request")).toBeInTheDocument();
    expect(screen.getByText("My Rejected Request")).toBeInTheDocument();
    expect(screen.getByText(/Needs more info/)).toBeInTheDocument();
    expect(screen.queryByText("Approved inactive")).not.toBeInTheDocument();
    await selectStatus("Pending review");
    await screen.findByText("My Pending Request");
    await waitFor(() => expect(screen.queryByText("My Rejected Request")).not.toBeInTheDocument());
    await selectStatus("Rejected");
    await screen.findByText("My Rejected Request");
    expect(screen.queryByText("My Pending Request")).not.toBeInTheDocument();
  });
});
