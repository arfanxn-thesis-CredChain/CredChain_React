import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import type { CredentialFacts } from "@shared/lib/credentialDate";
import { CredentialSystemFacts } from "./CredentialSystemFacts";

const facts: CredentialFacts = {
  id: "synthetic-credential-full-id",
  file_hash: "0x" + "a".repeat(64),
  token_id: "123456789012345678901234567890",
  status: "revoked",
  is_submission: true,
  created_at: "2026-01-01",
  activated_at: "2026-01-02",
  rejected_at: null,
  revoked_at: "2026-02-01",
  expires_at: "2026-01-31",
};

describe("CredentialSystemFacts", () => {
  it("keeps public footer visible and copies complete identifiers", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText");
    const { container } = render(<CredentialSystemFacts credential={facts} />, {
      wrapper: TestProviders,
    });
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByText("Approved")).toBeVisible();
    expect(screen.getByText("Revoked")).toBeVisible();
    for (const [label, value] of [
      [i18n.t("cred.copy.credentialId"), facts.id],
      [i18n.t("cred.copy.fileHash"), facts.file_hash],
      [i18n.t("cred.copy.tokenId"), facts.token_id],
    ] as const) {
      await user.click(screen.getByRole("button", { name: label }));
      expect(write).toHaveBeenLastCalledWith(value);
    }
    write.mockRestore();
  });

  it("uses Registered for direct issuance and omits absent token", async () => {
    await i18n.changeLanguage("en");
    render(
      <CredentialSystemFacts
        credential={{
          ...facts,
          is_submission: false,
          token_id: null,
          status: "expired",
          revoked_at: null,
        }}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText("Registered")).toBeVisible();
    expect(screen.getByText("Expired")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: i18n.t("cred.copy.tokenId") }),
    ).not.toBeInTheDocument();
  });
});
