import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import type { CredentialLifecycleStatus } from "@shared/types/api";
import { CredentialLifecycleStatusBadge } from "./CredentialLifecycleStatusBadge";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

const TONE_BY_STATUS: Record<CredentialLifecycleStatus, string> = {
  pending: "bg-gold/20",
  approved: "bg-green-100",
  rejected: "bg-error/10",
  revoked: "bg-gray-100",
};

describe("CredentialLifecycleStatusBadge", () => {
  it.each<[CredentialLifecycleStatus, string]>([
    ["pending", "Pending review"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["revoked", "Revoked"],
  ])("renders label for %s", (status, label) => {
    render(<CredentialLifecycleStatusBadge status={status} />, { wrapper: TestProviders });
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each<CredentialLifecycleStatus>(["pending", "approved", "rejected", "revoked"])(
    "uses the correct tone for %s",
    (status) => {
      const { container } = render(<CredentialLifecycleStatusBadge status={status} />, {
        wrapper: TestProviders,
      });
      const pill = container.querySelector("span");
      expect(pill?.className).toContain(TONE_BY_STATUS[status]);
    },
  );
});
