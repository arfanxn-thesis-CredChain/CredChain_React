import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { server } from "@/test/msw/server";
import { http, HttpResponse } from "msw";
import { Role } from "@shared/auth/role";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import { VerificationPublicDetailsModal } from "./VerificationPublicDetailsModal";
import type { VerificationPublicDetailsDTO } from "@shared/types/api";

describe("VerificationPublicDetailsModal", () => {
  it("uses original detail sections and always-visible footer without protected actions", async () => {
    await i18n.changeLanguage("en");
    const details: VerificationPublicDetailsDTO = {
      id: "credential-public",
      name: "Engineering",
      status: "approved",
      is_submission: true,
      issuer_organization_id: "org",
      number: "CERT-1",
      file_hash: "0x123",
      issued_at: "2026-01-01",
      expires_at: null,
      issuer_organization_name: "Example Academy",
      credential_type_name: "Diploma",
      revoked_at: null,
      holder: {
        name: "Synthetic Holder",
        number: "H-42",
        unit_name: "Engineering Unit",
        joined_year: 2024,
        email: "holder@example.test",
        gender: "female",
        role: Role.HOLDER,
        wallet_address: "0x1234567890123456789012345678901234567890",
        created_at: "2026-01-01",
        updated_at: null,
        deleted_at: null,
      },
      competencies: [{ name: "Design" }],
      meta: { grade: "A" },
      token_id: "42",
      created_at: "2026-01-01",
      activated_at: "2026-01-02",
      rejected_at: null,
    };
    let protectedCalls = 0;
    server.use(
      http.get("*/api/*", () => {
        protectedCalls++;
        return HttpResponse.json({}, { status: 403 });
      }),
    );
    render(
      <VerificationPublicDetailsModal
        details={details}
        file={new File(["file"], "original.txt")}
        open
        onOpenChange={() => {}}
      />,
      { wrapper: TestProviders },
    );
    for (const value of ["Synthetic Holder", "H-42", "Engineering Unit", "holder@example.test"])
      expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    await waitFor(() => expect(protectedCalls).toBe(0));
    expect(screen.getByRole("heading", { name: "Details" })).toBeInTheDocument();
    expect(screen.getAllByText("Holder")).toHaveLength(2);
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("original.txt")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeVisible();
    expect(screen.queryByText("Technical details")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download|edit/i })).not.toBeInTheDocument();
  });
  it("closes nested preview first, restores View focus and releases image URLs", async () => {
    await i18n.changeLanguage("en");
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation(() => `blob:synthetic-${Math.random()}`);
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const details: VerificationPublicDetailsDTO = {
      id: "record",
      name: "Synthetic",
      number: null,
      status: "approved",
      is_submission: false,
      issuer_organization_id: "org",
      file_hash: "hash",
      issued_at: "2026-01-01",
      expires_at: null,
      issuer_organization_name: null,
      credential_type_name: null,
      revoked_at: null,
      holder: null,
      competencies: [],
      meta: null,
      token_id: null,
      created_at: "2026-01-01",
      activated_at: null,
      rejected_at: null,
    };
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <VerificationPublicDetailsModal
          details={details}
          file={new File(["synthetic"], "upload.png", { type: "image/png" })}
          open={open}
          onOpenChange={setOpen}
        />
      );
    }
    const user = userEvent.setup();
    const view = render(<Harness />, { wrapper: TestProviders });
    const trigger = screen.getByRole("button", { name: "View" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "upload.png" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "upload.png" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog", { name: "Synthetic" })).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    view.unmount();
    for (const call of create.mock.results) expect(revoke).toHaveBeenCalledWith(call.value);
    create.mockRestore();
    revoke.mockRestore();
  });
});
