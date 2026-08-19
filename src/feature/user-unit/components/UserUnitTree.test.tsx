import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { makeUser } from "@/test/fixtures";
import { TestProviders } from "@/test/TestProviders";
import { server } from "@/test/msw/server";
import type { HolderUnitDTO } from "@shared/types/api";
import { UserUnitTree } from "./UserUnitTree";

function unit(overrides: Partial<HolderUnitDTO>): HolderUnitDTO {
  return {
    id: overrides.id ?? "unit_01",
    parent_id: overrides.parent_id ?? null,
    name: overrides.name ?? "Unit",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
  };
}

const units: HolderUnitDTO[] = [
  unit({ id: "unit_01", name: "Faculty of Engineering" }),
  unit({ id: "unit_02", parent_id: "unit_01", name: "Computer Science Department" }),
  unit({ id: "unit_04", parent_id: "unit_02", name: "Software Engineering Lab" }),
  unit({ id: "unit_03", name: "Faculty of Medicine" }),
];

function renderTree() {
  return render(<UserUnitTree units={units} />, { wrapper: TestProviders });
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  useStore.setState({
    user: makeUser({ id: "usr_admin", role: Role.ADMIN }),
    isAuthenticated: true,
  });
});

describe("UserUnitTree", () => {
  it("hides children until expanded, then collapses them again", async () => {
    const user = userEvent.setup();
    renderTree();

    expect(screen.getAllByText("Faculty of Engineering").length).toBeGreaterThan(0);
    expect(screen.queryByText("Computer Science Department")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand Faculty of Engineering" }));
    expect(screen.getByText("Computer Science Department")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse Faculty of Engineering" }));
    expect(screen.queryByText("Computer Science Department")).not.toBeInTheDocument();
  });

  it("renders the breadcrumb path under a nested row", async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByRole("button", { name: "Expand Faculty of Engineering" }));
    await user.click(screen.getByRole("button", { name: "Expand Computer Science Department" }));

    const path = screen.getByText("Faculty of Engineering › Computer Science Department › Software Engineering Lab");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("aria-label", "Breadcrumb path");
  });

  it("posts { name, parent_id } when creating a sub-unit", async () => {
    let recordedBody: unknown;
    server.use(
      http.post("*/api/user-units", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({
          code: 301001,
          message: "ok",
          data: unit({ id: "unit_new", parent_id: "unit_01", name: "Informatics" }),
        });
      }),
    );

    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByRole("button", { name: "Add sub-unit to Faculty of Engineering" }));
    await user.type(screen.getByRole("textbox", { name: "New unit name" }), "Informatics");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(recordedBody).toEqual({ name: "Informatics", parent_id: "unit_01" }));
  });

  it("PUTs { name } when renaming a unit", async () => {
    let recordedBody: unknown;
    let recordedUrl = "";
    server.use(
      http.put("*/api/user-units/:id", async ({ request }) => {
        recordedUrl = request.url;
        recordedBody = await request.json();
        return HttpResponse.json({ code: 301002, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByRole("button", { name: "Rename Faculty of Engineering" }));
    const renameInput = screen.getByRole("textbox", { name: "Unit name" });
    await user.clear(renameInput);
    await user.type(renameInput, "Faculty of Informatics");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(recordedUrl).toContain("/api/user-units/unit_01");
      expect(recordedBody).toEqual({ name: "Faculty of Informatics" });
    });
  });

  it("move dialog excludes self and descendants and PUTs the chosen parent_id", async () => {
    let recordedBody: unknown;
    server.use(
      http.put("*/api/user-units/:id", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 301002, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByRole("button", { name: "Expand Faculty of Engineering" }));
    await user.click(screen.getByRole("button", { name: "Move Computer Science Department" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("Computer Science Department")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Software Engineering Lab")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Top level (no parent)")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Faculty of Engineering")).toBeInTheDocument();
    expect(within(dialog).getByText("Faculty of Medicine")).toBeInTheDocument();

    await user.click(within(dialog).getByText("Faculty of Medicine"));
    await user.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => expect(recordedBody).toEqual({ parent_id: "unit_03" }));
  });

  it("shows a guarded confirm for destroy and renders an inline error on an in-use destroy", async () => {
    server.use(
      http.delete("*/api/user-units/:id", () =>
        HttpResponse.json({ code: 300650, message: "In use" }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete Faculty of Engineering?");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const error = await screen.findByText(
      "This unit is still referenced by users or child units and cannot be deleted.",
    );
    expect(error).toBeInTheDocument();
    expect(screen.getAllByText("Faculty of Engineering").length).toBeGreaterThan(0);
  });
});
