import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import {
  type UserBatchStoreFormInput,
  userBatchStoreFormSchema,
  defaultUserStoreFormRow,
} from "../schemas/user";
import { UserCreateRow } from "./UserCreateRow";
import type { UserKind } from "../UserCreate";

vi.mock("@shared/api/useUserUnits", () => ({
  useUserUnits: () => ({
    data: [
      { id: "unit_01", parent_id: null, name: "Faculty of Engineering" },
      { id: "unit_02", parent_id: "unit_01", name: "Computer Science Department" },
    ],
  }),
}));

function RowHarness({ kind = "employee" }: { kind?: UserKind }) {
  const form = useForm<UserBatchStoreFormInput>({
    resolver: zodResolver(userBatchStoreFormSchema),
    defaultValues: { users: [defaultUserStoreFormRow()] },
    mode: "onBlur",
  });
  return <UserCreateRow index={0} form={form} kind={kind} />;
}

describe("UserCreateRow (D2)", () => {
  beforeEach(() => {
    void i18n.changeLanguage("en");
  });

  it("does not render a phone field", () => {
    render(
      <TestProviders>
        <RowHarness />
      </TestProviders>,
    );
    expect(screen.queryByText(/phone/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("+6281234567890")).not.toBeInTheDocument();
  });

  it("renders a unit picker", async () => {
    render(
      <TestProviders>
        <RowHarness />
      </TestProviders>,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^unit$/i })).toBeInTheDocument();
    });
  });

  it("renders a joined year input", () => {
    render(
      <TestProviders>
        <RowHarness />
      </TestProviders>,
    );
    expect(screen.getByPlaceholderText("2024")).toBeInTheDocument();
  });

  it("lets the user pick a unit from the picker", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <RowHarness />
      </TestProviders>,
    );
    await user.click(await screen.findByRole("button", { name: /^unit$/i }));
    await user.click(await screen.findByRole("menuitem", { name: /faculty of engineering/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^unit$/i })).toHaveTextContent(
        "Faculty of Engineering",
      );
    });
  });

  it("shows the role picker for employee, hides it for student", () => {
    const { rerender } = render(
      <TestProviders>
        <RowHarness kind="employee" />
      </TestProviders>,
    );
    expect(screen.getByText("Role")).toBeInTheDocument();

    rerender(
      <TestProviders>
        <RowHarness kind="student" />
      </TestProviders>,
    );
    expect(screen.queryByText("Role")).not.toBeInTheDocument();
  });

  it("labels the identifier field ID Number for student, Employee Number for employee", () => {
    const { rerender } = render(
      <TestProviders>
        <RowHarness kind="student" />
      </TestProviders>,
    );
    expect(screen.getByText("ID Number")).toBeInTheDocument();
    expect(screen.getByText("Student ID, student number, etc.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("22100001")).toBeInTheDocument();

    rerender(
      <TestProviders>
        <RowHarness kind="employee" />
      </TestProviders>,
    );
    expect(screen.getByText("Employee Number")).toBeInTheDocument();
    expect(screen.getByText("Employee ID, staff number, etc.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("EMP-12345")).toBeInTheDocument();
  });
});
