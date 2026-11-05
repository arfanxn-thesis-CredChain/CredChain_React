import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import en from "@shared/i18n/en.json";
import id from "@shared/i18n/id.json";
import type { VerificationHolderDTO } from "@shared/types/api";
import { TestProviders } from "@/test/TestProviders";
import { VerificationResult } from "./VerificationResult";
import { VerificationPublicDetailsModal } from "./VerificationPublicDetailsModal";
import { i18n } from "@shared/i18n/config";
import { act } from "@testing-library/react";

const credential = {
  id: "record",
  name: "Public Diploma",
  credential_type_name: "Diploma",
  status: "revoked" as const,
  is_submission: true,
  issuer_organization_id: "org",
  issuer_organization_name: "Actual School",
  number: "D-2026",
  file_hash: "0xabc",
  issued_at: "2026-01-01",
  expires_at: null,
};
const details = {
  ...credential,
  issuer_organization_name: "Actual School",
  credential_type_name: "Diploma",
  revoked_at: "2026-02-01",
  holder: null,
  competencies: [],
  meta: null,
  token_id: "42",
  created_at: "2026-01-01",
  activated_at: "2026-01-02",
  rejected_at: null,
};
const result = {
  verdict_code: 400402,
  description: "",
  similarity_score: null,
  similarity_percent: null,
  credential,
  exact_match_confirmed: true,
  public_details: details,
};

describe("public verification report", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  const vagueTerms = /\b(records?|catatan|rekaman|entries|entry|entri|registry)\b/i;
  const holder: VerificationHolderDTO = {
    name: "Synthetic Holder",
    number: null,
    unit_name: null,
    joined_year: null,
    email: "holder@example.test",
    gender: null,
    role: "holder",
    wallet_address: "0x123",
    created_at: "2026-01-01",
    updated_at: null,
    deleted_at: null,
  };

  describe.each(["en", "id"])("verification terminology in %s", (language) => {
    beforeEach(async () => {
      await i18n.changeLanguage(language);
    });

    it("uses specific terms in all verification-owned translation values", () => {
      const locale = language === "en" ? en : id;
      const values = JSON.stringify(locale.cred.verify);
      // Scan values, not historical key names or user-provided credential content.
      const strings = [...values.matchAll(/:\s*"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]);
      const messages = Object.entries(locale)
        .filter(([key]) => key.startsWith("credential.verify."))
        .map(([, value]) => String(value));
      expect([...strings, ...messages].filter((value) => vagueTerms.test(value))).toEqual([]);
    });

    it.each([
      [400401, true],
      [400401, false],
      [400402, true],
      [400403, false],
      [400404, false],
      [400405, false],
      [400406, false],
      [400407, false],
      [400408, false],
      [400409, false],
      [400410, true],
      [400411, true],
      [400412, true],
      [400413, true],
      [999999, false],
    ] as const)("renders specific terminology for %s / exact %s", (code, exact) => {
      const noCredential = [400408, 400409, 999999].includes(code);
      const { container } = render(
        <VerificationResult
          result={{
            ...result,
            verdict_code: code,
            credential: noCredential ? null : credential,
            exact_match_confirmed: exact,
            public_details: exact ? details : null,
            similarity_score: code >= 400404 && code <= 400407 ? 1 : null,
          }}
          onOpenDetails={() => {}}
          onReset={() => {}}
          canViewPrivate={false}
        />,
        { wrapper: TestProviders },
      );
      expect(container.textContent).not.toMatch(vagueTerms);
      if (code === 400409) {
        expect(
          screen.getByRole("heading", {
            name:
              language === "en"
                ? "No matching credential found"
                : "Kredensial yang cocok tidak ditemukan",
          }),
        ).toBeVisible();
        expect(
          screen.getByText(
            language === "en"
              ? "This search did not find a matching credential in CredChain. That does not prove the document is fake."
              : "Pencarian ini tidak menemukan kredensial yang cocok di CredChain. Ini tidak membuktikan dokumen palsu.",
          ),
        ).toBeVisible();
      }
      if (code === 400404 || code === 400405) {
        expect(
          screen.getByText(
            language === "en"
              ? "Text in your uploaded file resembles text in a credential in CredChain, but this does not confirm the document's authenticity."
              : "Teks dalam berkas unggahan mirip dengan teks pada kredensial di CredChain, tetapi kemiripan ini belum memastikan keaslian dokumen.",
          ),
        ).toBeVisible();
      }
    });

    it.each([
      {
        name: "no summary",
        summary: false,
        qualified: false,
        hasHolder: false,
        mismatched: false,
        count: 1,
      },
      {
        name: "comparison summary",
        summary: true,
        qualified: false,
        hasHolder: true,
        mismatched: false,
        count: 2,
      },
      {
        name: "exact without Holder",
        summary: true,
        qualified: true,
        hasHolder: false,
        mismatched: false,
        count: 2,
      },
      {
        name: "exact with Holder",
        summary: true,
        qualified: true,
        hasHolder: true,
        mismatched: false,
        count: 3,
      },
      {
        name: "mismatched details",
        summary: true,
        qualified: true,
        hasHolder: true,
        mismatched: true,
        count: 2,
      },
    ])(
      "shows only relevant limits for $name",
      ({ summary, qualified, hasHolder, mismatched, count }) => {
        render(
          <VerificationResult
            result={{
              ...result,
              verdict_code: !summary ? 400409 : qualified ? 400401 : 400404,
              credential: summary ? credential : null,
              exact_match_confirmed: qualified,
              public_details: {
                ...details,
                id: mismatched ? "other" : credential.id,
                holder: hasHolder ? holder : null,
              },
            }}
            onOpenDetails={() => {}}
            onReset={() => {}}
            canViewPrivate={false}
          />,
          { wrapper: TestProviders },
        );
        const limits = within(screen.getByRole("list"));
        expect(limits.getAllByRole("listitem")).toHaveLength(count);
        expect(limits.getByText(i18n.t("cred.verify.report.recipientLimit"))).toBeVisible();
        expect(!!limits.queryByText(i18n.t("cred.verify.report.metadataLimit"))).toBe(summary);
        const holderLimit =
          language === "en"
            ? "Holder account details reflect current CredChain data and may differ from details at issuance."
            : "Informasi akun pemegang mengikuti data CredChain saat ini dan dapat berbeda dari informasi saat penerbitan.";
        expect(!!limits.queryByText(holderLimit)).toBe(count === 3);
      },
    );
  });

  it("uses qualified exact details only when an older summary omits organization name", () => {
    const legacyCredential = { ...credential };
    Reflect.deleteProperty(legacyCredential, "issuer_organization_name");
    render(
      <VerificationResult
        result={{ ...result, credential: legacyCredential }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText("Actual School")).toBeVisible();
  });
  it("uses Not set for an empty credential name", () => {
    render(
      <VerificationResult
        result={{ ...result, credential: { ...credential, name: "" } }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText("Not set")).toBeVisible();
  });
  it("does not replace an explicit null organization with exact details", () => {
    render(
      <VerificationResult
        result={{ ...result, credential: { ...credential, issuer_organization_name: null } }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText("Actual School")).not.toBeInTheDocument();
  });
  it.each(["en", "id"])(
    "renders agreed copy and unchanged field labels in %s",
    async (language) => {
      await i18n.changeLanguage(language);
      const { rerender } = render(
        <VerificationResult
          result={{ ...result, verdict_code: 400401 }}
          onOpenDetails={() => {}}
          onReset={() => {}}
          canViewPrivate={false}
        />,
        { wrapper: TestProviders },
      );
      expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(
        language === "en"
          ? [
              "Verification method",
              "Credential status",
              "Credential name",
              "Credential number",
              "Credential type",
              "Issuer organization",
            ]
          : [
              "Metode verifikasi",
              "Status kredensial",
              "Nama kredensial",
              "Nomor kredensial",
              "Tipe kredensial",
              "Organisasi penerbit",
            ],
      );
      expect(
        screen.getByText(
          language === "en"
            ? "Your uploaded file is identical to the registered file, and credential data on the blockchain matches."
            : "Berkas yang Anda unggah identik dengan berkas terdaftar, dan data kredensial di blockchain cocok.",
        ),
      ).toBeVisible();
      expect(screen.getByText(i18n.t("cred.verify.report.exact.next"))).toBeVisible();
      expect(screen.queryByText(i18n.t("cred.verify.report.provenance"))).not.toBeInTheDocument();
      rerender(
        <VerificationResult
          result={{
            ...result,
            verdict_code: 400404,
            exact_match_confirmed: false,
            public_details: null,
            similarity_score: 1,
          }}
          onOpenDetails={() => {}}
          onReset={() => {}}
          canViewPrivate={false}
        />,
      );
      expect(
        screen.getByRole("heading", {
          name: language === "en" ? "Similar text found" : "Teks serupa ditemukan",
        }),
      ).toBeVisible();
      expect(screen.getByText(i18n.t("cred.verify.report.scoreLimit"))).toBeVisible();
      expect(screen.getByText(i18n.t("cred.verify.report.candidateStatus"))).toBeVisible();
      expect(
        screen.getByRole("heading", { name: i18n.t("cred.verify.report.comparedCredential") }),
      ).toBeVisible();
      expect(screen.getByText("Actual School")).toBeVisible();
      expect(
        screen.queryByRole("button", { name: i18n.t("cred.verify.report.viewCredentialDetails") }),
      ).not.toBeInTheDocument();
      await act(() => i18n.changeLanguage("en"));
    },
  );
  it.each([true, false])("keeps six ordered fields for exact=%s", async (exact) => {
    await i18n.changeLanguage("en");
    render(
      <VerificationResult
        result={{
          ...result,
          verdict_code: exact ? 400402 : 400404,
          exact_match_confirmed: exact,
          credential: { ...credential, number: null },
          public_details: exact ? details : null,
        }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Verification method",
      "Credential status",
      "Credential name",
      "Credential number",
      "Credential type",
      "Issuer organization",
    ]);
    expect(screen.getByText("Actual School")).toBeVisible();
    expect(screen.getByText("Diploma")).toBeVisible();
    expect(screen.getByText("Not set")).toBeVisible();
    expect(screen.queryByText("org")).not.toBeInTheDocument();
  });
  it("shows unavailable when linked type and organization names are null", () => {
    render(
      <VerificationResult
        result={{
          ...result,
          credential: {
            ...credential,
            credential_type_name: null,
            issuer_organization_name: null,
          },
        }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getAllByText("Unavailable")).toHaveLength(2);
    expect(screen.queryByText("org")).not.toBeInTheDocument();
  });
  it("does not render an empty credential grid", () => {
    render(
      <VerificationResult
        result={{
          ...result,
          credential: null,
          public_details: null,
          exact_match_confirmed: false,
          verdict_code: 400409,
        }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByRole("term")).not.toBeInTheDocument();
  });
  it("does not use unqualified details for candidate organization", () => {
    render(
      <VerificationResult
        result={{
          ...result,
          credential: { ...credential, issuer_organization_name: null },
          exact_match_confirmed: false,
          verdict_code: 400404,
        }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText("Actual School")).not.toBeInTheDocument();
  });
  it("opens meaningful anonymous details and retains revocation warning", async () => {
    await i18n.changeLanguage("en");
    render(
      <>
        <VerificationResult
          result={result}
          onOpenDetails={() => {}}
          onReset={() => {}}
          canViewPrivate={false}
        />
        <VerificationPublicDetailsModal
          details={details}
          open
          onOpenChange={() => {}}
          file={new File(["synthetic"], "upload.txt", { type: "text/plain" })}
        />
      </>,
      { wrapper: TestProviders },
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Actual School");
    expect(dialog).toHaveTextContent("Diploma");
    expect(screen.getByText("Credential revoked")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("recipient");
    expect(screen.queryByRole("link", { name: "Open private record" })).not.toBeInTheDocument();
    expect(screen.queryByText("University of Indonesia")).not.toBeInTheDocument();
    // Radix correctly hides the underlying report from assistive technology while open.
    expect(screen.getByText("View credential details")).toBeInTheDocument();
    await act(() => i18n.changeLanguage("id"));
    expect(dialog).toHaveTextContent("Organisasi penerbit");
    await act(() => i18n.changeLanguage("en"));
  });
  it("keeps AI score visible and never unlocks details", async () => {
    await i18n.changeLanguage("en");
    render(
      <VerificationResult
        result={{
          ...result,
          verdict_code: 400404,
          similarity_score: 1,
          exact_match_confirmed: false,
        }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(
      screen.queryByRole("button", { name: "View credential details" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Compared credential" })).toBeInTheDocument();
    expect(screen.getByText("Credential status")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeVisible();
    expect(
      screen.getByText(/Text similarity does not establish authenticity or prove alteration/),
    ).toBeInTheDocument();
  });
  it.each([0.985, 1])("shows numeric text similarity %s without public access", (score) => {
    render(
      <VerificationResult
        result={{
          ...result,
          verdict_code: 400404,
          similarity_score: score,
          similarity_percent: "invented",
          exact_match_confirmed: false,
        }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText(score === 1 ? "100%" : "98.5%")).toBeVisible();
    expect(screen.queryByText("invented")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View .*credential/ })).not.toBeInTheDocument();
  });
  it.each([null, NaN, Infinity, -0.1, 1.1])(
    "does not invent similarity for invalid score %s",
    (score) => {
      render(
        <VerificationResult
          result={{
            ...result,
            verdict_code: 400404,
            similarity_score: score,
            exact_match_confirmed: false,
          }}
          onOpenDetails={() => {}}
          onReset={() => {}}
          canViewPrivate={false}
        />,
        { wrapper: TestProviders },
      );
      expect(screen.queryByText("Text similarity")).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    },
  );
  it("qualifies current Holder account facts outside the modal", () => {
    render(
      <VerificationResult
        result={{ ...result, public_details: { ...details, holder } }}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(
      screen.getByText(
        "Holder account details reflect current CredChain data and may differ from details at issuance.",
      ),
    ).toBeInTheDocument();
  });
  it("does not cast doubt on the confirmed exact fingerprint", () => {
    render(
      <VerificationResult
        result={result}
        onOpenDetails={() => {}}
        onReset={() => {}}
        canViewPrivate={false}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByText(/not necessarily your uploaded file/)).not.toBeInTheDocument();
  });
  it("shows null metadata honestly without exposing organization ID", () => {
    render(
      <VerificationPublicDetailsModal
        details={{ ...details, issuer_organization_name: null, credential_type_name: null }}
        open
        onOpenChange={() => {}}
        file={null}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
    expect(screen.queryByText("org")).not.toBeInTheDocument();
  });
});
