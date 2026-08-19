import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { COLUMN_TO_FIELD, FIXED_COLUMNS, UserImportModal } from "./UserImportModal";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

describe("UserImportModal columns (D2)", () => {
  it("removes the phone column from FIXED_COLUMNS", () => {
    expect(FIXED_COLUMNS).not.toContain("phone");
  });

  it("adds unit_id and joined_year columns to FIXED_COLUMNS", () => {
    expect(FIXED_COLUMNS).toContain("unit_id");
    expect(FIXED_COLUMNS).toContain("joined_year");
  });

  it("maps unit_id and joined_year fields, and drops phone_number mapping", () => {
    expect(COLUMN_TO_FIELD.unit_id).toBe("unit_id");
    expect(COLUMN_TO_FIELD.joined_year).toBe("joined_year");
    expect("phone" in COLUMN_TO_FIELD).toBe(false);
  });

  it("keeps the required columns", () => {
    for (const col of ["fullname", "email", "role"]) {
      expect(FIXED_COLUMNS).toContain(col);
    }
  });
});

describe("UserImportModal", () => {
  it("renders the import dialog when open", () => {
    render(<UserImportModal open onClose={() => {}} onImport={() => {}} />, {
      wrapper: TestProviders,
    });
    expect(screen.getByText("Import Users from File")).toBeInTheDocument();
  });
});
