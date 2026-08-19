import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HolderSearchDropdown } from "./HolderSearchDropdown";
import type { UserDTO } from "@shared/types/api";

const MOCK_USERS: UserDTO[] = [
  {
    id: "u1",
    name: "John Doe",
    email: "john@example.com",
    number: "22091234",
    unit_id: null,
    joined_year: null,
    wallet_address: "0xAb1234567890abcdef1234567890abcdef123456",
    role: "holder" as const,
    meta: null,
    gender: null,
    birth_date: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  },
  {
    id: "u2",
    name: "Jane Smith",
    email: "jane@example.com",
    number: "22095678",
    unit_id: null,
    joined_year: null,
    wallet_address: "0xF34abcdef1234567890abcdef1234567890abcde",
    role: "holder" as const,
    meta: null,
    gender: null,
    birth_date: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  },
];

describe("HolderSearchDropdown", () => {
  it("renders search input with placeholder", async () => {
    const onSearch = vi.fn().mockResolvedValue([]);
    render(
      <HolderSearchDropdown
        value=""
        onChange={() => {}}
        onSearch={onSearch}
        searchPlaceholder="Search holders..."
        noResultsText="No results"
      />,
    );
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    expect(screen.getByPlaceholderText("Search holders...")).toBeInTheDocument();
  });

  it("calls onSearch with debounced query", async () => {
    const onSearch = vi.fn().mockResolvedValue([]);
    render(
      <HolderSearchDropdown
        value=""
        onChange={() => {}}
        onSearch={onSearch}
        searchPlaceholder="Search..."
        noResultsText="No results"
      />,
    );
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "john");
    await waitFor(
      () => {
        expect(onSearch).toHaveBeenCalledWith("john");
      },
      { timeout: 500 },
    );
  });

  it("displays search results with name and number", async () => {
    const onSearch = vi.fn().mockResolvedValue(MOCK_USERS);
    render(
      <HolderSearchDropdown
        value=""
        onChange={() => {}}
        onSearch={onSearch}
        searchPlaceholder="Search..."
        noResultsText="No results"
      />,
    );
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "John");
    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("22091234")).toBeInTheDocument();
    });
  });

  it("shows no-results text when search returns empty", async () => {
    const onSearch = vi.fn().mockResolvedValue([]);
    render(
      <HolderSearchDropdown
        value=""
        onChange={() => {}}
        onSearch={onSearch}
        searchPlaceholder="Search..."
        noResultsText="Nothing found"
      />,
    );
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "zzz");
    await waitFor(() => {
      expect(screen.getByText("Nothing found")).toBeInTheDocument();
    });
  });

  it("calls onChange when an item is selected", async () => {
    const onSearch = vi.fn().mockResolvedValue(MOCK_USERS);
    const onChange = vi.fn();
    render(
      <HolderSearchDropdown
        value=""
        onChange={onChange}
        onSearch={onSearch}
        searchPlaceholder="Search..."
        noResultsText="No results"
      />,
    );
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "John");
    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("John Doe"));
    expect(onChange).toHaveBeenCalledWith("u1");
  });
});
