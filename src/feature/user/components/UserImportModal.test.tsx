import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import {
  COLUMN_TO_FIELD,
  FIXED_COLUMNS,
  normHeader,
  templateRows,
  UserImportModal,
} from "./UserImportModal";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

describe("UserImportModal columns (D2)", () => {
  it("removes the phone column from FIXED_COLUMNS", () => {
    expect(FIXED_COLUMNS).not.toContain("phone");
  });

  it("names the unit and number columns without the _id suffix", () => {
    expect(FIXED_COLUMNS).toContain("unit");
    expect(FIXED_COLUMNS).toContain("number");
    expect(FIXED_COLUMNS).toContain("joined_year");
    expect(FIXED_COLUMNS).not.toContain("unit_id");
    expect(FIXED_COLUMNS).not.toContain("number_id");
  });

  it("maps the renamed columns onto the unchanged field names", () => {
    expect(COLUMN_TO_FIELD.unit).toBe("unit_id");
    expect(COLUMN_TO_FIELD.number).toBe("number");
    expect(COLUMN_TO_FIELD.joined_year).toBe("joined_year");
    expect("phone" in COLUMN_TO_FIELD).toBe(false);
  });

  it("rewrites headers from pre-rename templates, so old files still import", () => {
    expect(normHeader(" Unit_ID ")).toBe("unit");
    expect(normHeader("number_id")).toBe("number");
    // Unrecognised headers pass through lowercased and become meta entries.
    expect(normHeader(" Program Studi ")).toBe("program studi");
  });

  it("keeps the required columns", () => {
    for (const col of ["fullname", "email", "role"]) {
      expect(FIXED_COLUMNS).toContain(col);
    }
  });
});

describe("templateRows", () => {
  const roleIndex = FIXED_COLUMNS.indexOf("role");

  it("keeps every student example row at role=holder", () => {
    for (const row of templateRows([], "student")) {
      expect(row[roleIndex]).toBe("holder");
    }
  });

  it("still shows a non-holder role in the employee example", () => {
    expect(templateRows([], "employee").some((row) => row[roleIndex] !== "holder")).toBe(true);
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
