import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import type { CredentialStatus } from "@shared/types/api";
import { CredentialStatusBadge } from "./CredentialStatusBadge";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

const TONE_BY_STATUS: Record<CredentialStatus, string> = {
  pending: "bg-gold/20",
  approved: "bg-green-100",
  rejected: "bg-error/10",
  revoked: "bg-gray-100",
};

describe("CredentialStatusBadge", () => {
  it.each<[CredentialStatus, string]>([
    ["pending", "Pending review"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["revoked", "Revoked"],
  ])("renders label for %s", (status, label) => {
    render(<CredentialStatusBadge status={status} />, { wrapper: TestProviders });
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each<[CredentialStatus, string]>([
    ["pending", "Pending review"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["revoked", "Revoked"],
  ])("uses the correct tone for %s", (status, label) => {
    render(<CredentialStatusBadge status={status} />, { wrapper: TestProviders });
    const pill = screen.getByText(label).closest("span");
    expect(pill?.className).toContain(TONE_BY_STATUS[status]);
    expect(pill?.querySelector("svg")).toBeInTheDocument();
  });

  it("renders Registered when approved credential is from direct issuance", () => {
    render(<CredentialStatusBadge status="approved" isSubmission={false} />, {
      wrapper: TestProviders,
    });
    expect(screen.getByText("Registered")).toBeInTheDocument();
    const pill = screen.getByText("Registered").closest("span");
    expect(pill?.className).toContain("bg-green-100");
  });

  it("renders Approved when approved credential is from submission flow", () => {
    render(<CredentialStatusBadge status="approved" isSubmission={true} />, {
      wrapper: TestProviders,
    });
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("localizes contextual approved labels in Indonesian", async () => {
    await i18n.changeLanguage("id");

    const { rerender } = render(
      <CredentialStatusBadge status="approved" isSubmission={false} />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText("Didaftarkan")).toBeInTheDocument();

    rerender(<CredentialStatusBadge status="approved" isSubmission={true} />);
    expect(screen.getByText("Disetujui")).toBeInTheDocument();
  });
});
