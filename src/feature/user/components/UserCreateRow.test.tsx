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

vi.mock("@shared/api/useUserUnits", () => ({
  useUserUnits: () => ({
    data: [
      { id: "unit_01", parent_id: null, name: "Faculty of Engineering" },
      { id: "unit_02", parent_id: "unit_01", name: "Computer Science Department" },
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
});
