import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { StagedValue } from "./StagedValue";

describe("StagedValue", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders resolved name when present", () => {
    render(<StagedValue resolved="Bachelor of Science" staged="BS Staged" />, { wrapper: TestProviders });
    expect(screen.getByText("Bachelor of Science")).toBeInTheDocument();
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
  });

  it("renders staged name with pending indicator when resolved is missing", () => {
    const { container } = render(<StagedValue staged="Custom Degree" />, { wrapper: TestProviders });
    expect(screen.getByText("Custom Degree")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders custom fallback when neither resolved nor staged is present", () => {
    render(<StagedValue fallback={<span>Custom fallback</span>} />, { wrapper: TestProviders });
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
  });

  it("renders default dash when no values or fallback are provided", () => {
    render(<StagedValue />, { wrapper: TestProviders });
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
