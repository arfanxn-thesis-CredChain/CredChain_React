import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { UserCreate } from "./UserCreate";

vi.mock("@shared/api/useUserUnits", () => ({
  useUserUnits: () => ({
    data: [
      { id: "unit_01", parent_id: null, name: "Faculty of Engineering" },
      { id: "unit_02", parent_id: "unit_01", name: "Computer Science Department" },
    ],
  }),
}));

vi.mock("./api/useCreateUsers", () => ({
  useCreateUsers: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("UserCreate Step 1 navigation", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders Step 1 with Student and Employee cards and no Continue button", () => {
    render(<UserCreate />, { wrapper: TestProviders });

    expect(screen.getByText("Who are you registering?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /student/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /employee/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^continue$/i })).not.toBeInTheDocument();
  });

  it("advances to Step 2 immediately on clicking Student", async () => {
    render(<UserCreate />, { wrapper: TestProviders });

    await userEvent.click(screen.getByRole("button", { name: /student/i }));

    // Step 2 is active: shows form, ID Number label, no role picker for student
    expect(screen.getByText("ID Number")).toBeInTheDocument();
    expect(screen.queryByText("Who are you registering?")).not.toBeInTheDocument();
    expect(screen.queryByText("Role")).not.toBeInTheDocument();
  });

  it("advances to Step 2 immediately on clicking Employee", async () => {
    render(<UserCreate />, { wrapper: TestProviders });

    await userEvent.click(screen.getByRole("button", { name: /employee/i }));

    // Step 2 is active: shows form, Employee Number label, and role picker
    expect(screen.getByText("Employee Number")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
  });

  it("returns to Step 1 when clicking Back from Step 2", async () => {
    render(<UserCreate />, { wrapper: TestProviders });

    // Advance to Step 2
    await userEvent.click(screen.getByRole("button", { name: /student/i }));
    expect(screen.getByText("ID Number")).toBeInTheDocument();

    // Click Back
    await userEvent.click(screen.getByRole("button", { name: /back/i }));

    // Back in Step 1
    expect(screen.getByText("Who are you registering?")).toBeInTheDocument();
    expect(screen.queryByText("ID Number")).not.toBeInTheDocument();
  });
});
