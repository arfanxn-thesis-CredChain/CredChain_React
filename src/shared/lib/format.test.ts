import { describe, it, expect } from "vitest";
import {
  truncateAddress,
  truncateId,
  truncateHash,
  formatDate,
  formatDateTime,
  toKebabCase,
} from "./format";

describe("format", () => {
  describe("truncateAddress", () => {
    it("returns the original string when it is short", () => {
      expect(truncateAddress("short")).toBe("short");
    });

    it("truncates to 10 leading and 4 trailing characters by default", () => {
      expect(truncateAddress("0x1234567890123456789012345678901234567890")).toBe(
        "0x12345678...7890",
      );
    });

    it("supports custom lead and tail lengths", () => {
      expect(truncateAddress("0x12345678901234567890", 4, 4)).toBe("0x12...7890");
    });
  });

  describe("truncateId", () => {
    it("returns the original string when it is short", () => {
      expect(truncateId("cred_test_1")).toBe("cred_test_1");
    });

    it("truncates to 10 leading and 4 trailing characters by default", () => {
      expect(truncateId("01J8K2M3N4P5Q6R7S8T9U0V1W")).toBe("01J8K2M3N4...0V1W");
    });

    it("supports custom lead and tail lengths", () => {
      expect(truncateId("01J8K2M3N4P5Q6R7S8T9U0V1W", 6, 6)).toBe("01J8K2...9U0V1W");
    });
  });

  describe("truncateHash", () => {
    it("returns the original string when it is short", () => {
      expect(truncateHash("short")).toBe("short");
    });

    it("truncates to the specified length with ellipsis", () => {
      expect(truncateHash("0x1234567890abcdef", 8)).toBe("0x123456...");
    });
  });

  describe("formatDate", () => {
    it("formats an ISO date in English by default", () => {
      expect(formatDate("2026-06-18", "en")).toMatch(/Jun 18, 2026/);
    });

    it("formats Indonesian with full month", () => {
      expect(formatDate(new Date(2025, 5, 25), "id")).toBe("25 Juni 2025");
    });

    it("does not shift a date-only string to the previous day in western timezones", () => {
      expect(formatDate("2025-06-25", "id")).toBe("25 Juni 2025");
    });

    it("returns a dash for null values", () => {
      expect(formatDate(null)).toBe("-");
    });
  });

  describe("formatDateTime", () => {
    it("formats Indonesian dates with full month and 24-hour time", () => {
      expect(formatDateTime(new Date(2025, 5, 25, 7, 0), "id")).toBe("25 Juni 2025, 07.00");
    });

    it("retains English time formatting", () => {
      expect(formatDateTime(new Date(2025, 5, 25, 7, 0), "en")).toMatch(/Jun 25, 2025, 07:00 AM/);
    });
  });

  describe("locale", () => {
    it("keeps date-only input local", () => {
      expect(formatDate(new Date(2025, 5, 25), "id")).toBe("25 Juni 2025");
    });
  });

  describe("toKebabCase", () => {
    it("converts space-separated words to kebab-case", () => {
      expect(toKebabCase("Bachelor of Computer Science")).toBe("bachelor-of-computer-science");
    });

    it("lowercases the input", () => {
      expect(toKebabCase("UPPER CASE")).toBe("upper-case");
    });

    it("removes non-alphanumeric characters except hyphens and spaces", () => {
      expect(toKebabCase("Hello! @World #2024")).toBe("hello-world-2024");
    });

    it("collapses multiple spaces and hyphens", () => {
      expect(toKebabCase("a   b---c")).toBe("a-b-c");
    });

    it("trims leading and trailing hyphens", () => {
      expect(toKebabCase("  hello world  ")).toBe("hello-world");
    });

    it("returns empty string for empty input", () => {
      expect(toKebabCase("")).toBe("");
    });

    it("handles single word", () => {
      expect(toKebabCase("Diploma")).toBe("diploma");
    });

    it("handles mixed case with punctuation", () => {
      expect(toKebabCase("Bachelor's Degree")).toBe("bachelors-degree");
    });
  });
});
