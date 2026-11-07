import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { makeUser } from "@/test/fixtures";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
import { ReferenceToolbar, type ReferenceToolbarProps } from "./ReferenceToolbar";

function renderToolbar(onChange = vi.fn(), props: Partial<ReferenceToolbarProps> = {}) {
  return render(
    <ReferenceToolbar
      resource="competencies"
      rows={[]}
      createLabel="Create"
      searchValue=""
      onSearchChange={vi.fn()}
      statusFilter="active"
      onStatusFilterChange={onChange}
      {...props}
    />,
    { wrapper: TestProviders },
  );
}

describe("reference toolbar status buttons", () => {
  beforeEach(() => {
    void i18n.changeLanguage("en");
    useStore.setState({ user: makeUser({ role: Role.ISSUER }), isAuthenticated: true });
  });

  it("shows all filters with a single pressed state and passes each filter value", async () => {
    const change = vi.fn();
    renderToolbar(change, { statusFilter: "rejected" });
    const group = screen.getByRole("group", { name: "Status" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(6);
    for (const [index, status] of [
      "active",
      "all",
      "approved",
      "inactive",
      "pending",
      "rejected",
    ].entries()) {
      expect(buttons[index]).toHaveAttribute("type", "button");
      expect(buttons[index]).toHaveAttribute("aria-pressed", String(status === "rejected"));
      expect(buttons[index]).toHaveClass("h-9", "px-3", "text-xs", "rounded-xl");
      await userEvent.click(buttons[index]);
      expect(change).toHaveBeenLastCalledWith(status);
    }
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request New/ })).toBeInTheDocument();
  });

  it("announces zero and selects Pending through Enter and Space without opening a menu", async () => {
    server.use(
      http.get("*/api/competencies", () =>
        HttpResponse.json({ code: 401000, data: { items: [], total: 0 } }),
      ),
    );
    const change = vi.fn();
    renderToolbar(change);
    await screen.findByLabelText("0 items awaiting review");
    const pending = screen.getByRole("button", { name: /Pending review/ });
    pending.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(change).toHaveBeenCalledTimes(2);
    expect(change).toHaveBeenLastCalledWith("pending");
  });

  it("hides Inactive and reviewer counts from holders and falls back to Active", () => {
    useStore.setState({ user: makeUser({ role: Role.HOLDER }) });
    renderToolbar(vi.fn(), { statusFilter: "inactive" });
    expect(screen.queryByRole("button", { name: "Inactive" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText(/review count|items? awaiting review/i)).not.toBeInTheDocument();
  });

  it("announces loading without presenting it as zero", async () => {
    server.use(
      http.get("*/api/competencies", async () => {
        await delay("infinite");
        return HttpResponse.json({ code: 401000, data: { items: [], total: 0 } });
      }),
    );
    renderToolbar();
    expect(screen.getByLabelText("Loading review count…")).toHaveTextContent("…");
    expect(screen.queryByLabelText("0 items awaiting review")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pending review/ })).toBeEnabled();
  });

  it("exposes failed counts and retries without presenting zero", async () => {
    let failed = true;
    server.use(
      http.get("*/api/competencies", () =>
        failed
          ? HttpResponse.json({}, { status: 500 })
          : HttpResponse.json({ code: 401000, data: { items: [], total: 4 } }),
      ),
    );
    renderToolbar();
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(retry).toHaveClass("h-9", "px-3", "text-xs");
    expect(screen.getByLabelText("Unable to load review count.")).toBeInTheDocument();
    expect(screen.queryByLabelText("0 items awaiting review")).not.toBeInTheDocument();
    failed = false;
    await userEvent.click(retry);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument(),
    );
    expect(await screen.findByLabelText("4 items awaiting review")).toBeInTheDocument();
  });

  it("omits filters when no change callback is provided", () => {
    renderToolbar(vi.fn(), { onStatusFilterChange: undefined });
    expect(screen.queryByRole("group", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });
});
