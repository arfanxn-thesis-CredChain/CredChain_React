import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

vi.mock("../api/useUserUnits", () => ({
  useUserUnits: () => ({
    data: [
      { id: "unit_01", name: "Faculty of Engineering" },
      { id: "unit_02", name: "Computer Science Department" },
    ],
  }),
}));

function RowHarness() {
  const form = useForm<UserBatchStoreFormInput>({
    resolver: zodResolver(userBatchStoreFormSchema),
    defaultValues: { users: [defaultUserStoreFormRow()] },
    mode: "onBlur",
  });
  return <UserCreateRow index={0} form={form} />;
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

  it("renders a unit select", async () => {
    render(
      <TestProviders>
        <RowHarness />
      </TestProviders>,
    );
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /unit/i })).toBeInTheDocument();
    });
  });

  it("renders a joined year input", () => {
    render(
      <TestProviders>
        <RowHarness />
      </TestProviders>,
    );
    expect(screen.getByPlaceholderText("e.g. 2024")).toBeInTheDocument();
  });

  it("lets the user pick a unit from the select", async () => {
    render(
      <TestProviders>
        <RowHarness />
      </TestProviders>,
    );
    const trigger = await screen.findByRole("combobox", { name: /unit/i });
    fireEvent.click(trigger);
    const option = await screen.findByRole("option", { name: /faculty of engineering/i });
    fireEvent.click(option);
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /unit/i })).toHaveTextContent(
        "Faculty of Engineering",
      );
    });
  });
});
