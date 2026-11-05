import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useStore } from "@app/store";
import { i18n } from "@shared/i18n/config";
import { VerifyCredential } from "./VerifyCredential";
import { makeCredential, makeUser } from "@/test/fixtures";
import { Role } from "@shared/auth/role";

const credential = {
  id: "public-record",
  name: "Synthetic Diploma",
  status: "approved",
  is_submission: false,
  issuer_organization_id: "org",
  issuer_organization_name: "Synthetic School",
  number: null,
  file_hash: "0xabc",
  issued_at: "2026-01-01",
  expires_at: null,
};
const exact = {
  verdict_code: 400401,
  description: "",
  similarity_score: null,
  similarity_percent: null,
  credential,
  exact_match_confirmed: true,
  public_details: {
    ...credential,
    issuer_organization_name: "Synthetic School",
    credential_type_name: "Diploma",
    revoked_at: null,
    holder: {
      name: "Public Synthetic Holder",
      number: "H-42",
      unit_name: "Synthetic Unit",
      joined_year: 2024,
      email: "holder@example.test",
      gender: null,
      role: Role.HOLDER,
      wallet_address: "0x" + "1".repeat(40),
      created_at: "2026-01-01",
      updated_at: null,
      deleted_at: null,
    },
    competencies: [],
    meta: null,
    token_id: "42",
    created_at: "2026-01-01",
    activated_at: "2026-01-02",
    rejected_at: null,
  },
};

beforeEach(async () => {
  useStore.setState({ user: null, isAuthenticated: false });
  await i18n.changeLanguage("en");
});
describe("VerifyCredential HTTP integration", () => {
  it.each([false, true])(
    "retains icon file controls after candidate=%s and restores focus",
    async (candidate) => {
      server.use(
        http.post("*/api/credentials/verify", () =>
          HttpResponse.json({
            code: candidate ? 400404 : 400401,
            data: candidate
              ? {
                  ...exact,
                  verdict_code: 400404,
                  exact_match_confirmed: false,
                  public_details: null,
                  similarity_score: 1,
                }
              : exact,
          }),
        ),
      );
      const user = userEvent.setup();
      const { container } = render(<VerifyCredential />, { wrapper: TestProviders });
      const file = new File(["synthetic"], "synthetic.png", { type: "image/png" });
      await user.upload(container.querySelector('input[type="file"]')!, file);
      const eye = screen.getByRole("button", { name: i18n.t("credential.issue.preview.expand") });
      const remove = screen.getByRole("button", {
        name: i18n.t("credential.issue.preview.remove"),
      });
      const metadata = screen.getByText(/9 B/);
      await user.click(screen.getByRole("button", { name: /Verify Document/i }));
      await screen.findByRole("heading", { name: "Verification result" });
      expect(eye).toBeInTheDocument();
      expect(remove).toBeInTheDocument();
      expect(metadata).toBeInTheDocument();
      expect(metadata).toHaveTextContent("image/png");
      expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Change document" })).not.toBeInTheDocument();
      await user.click(eye);
      expect(screen.getByRole("dialog")).toBeVisible();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(eye).toHaveFocus());
      await user.click(remove);
      expect(
        screen.queryByRole("heading", { name: "Verification result" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: i18n.t("credential.issue.preview.dragDrop") }),
      ).toHaveFocus();
    },
  );

  it("returns reset focus to upload control", async () => {
    server.use(
      http.post("*/api/credentials/verify", () => HttpResponse.json({ code: 400401, data: exact })),
    );
    const user = userEvent.setup();
    const { container } = render(<VerifyCredential />, { wrapper: TestProviders });
    await user.upload(
      container.querySelector('input[type="file"]')!,
      new File(["synthetic"], "synthetic.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /Verify Document/i }));
    await user.click(await screen.findByRole("button", { name: "Verify another document" }));
    expect(
      screen.getByRole("button", { name: i18n.t("credential.issue.preview.dragDrop") }),
    ).toHaveFocus();
  });

  it("removes completed result, rejects invalid drop, and accepts another file", async () => {
    server.use(
      http.post("*/api/credentials/verify", () => HttpResponse.json({ code: 400401, data: exact })),
    );
    const user = userEvent.setup();
    const { container } = render(<VerifyCredential />, { wrapper: TestProviders });
    await user.upload(
      container.querySelector('input[type="file"]')!,
      new File(["synthetic"], "first.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /Verify Document/i }));
    await screen.findByRole("heading", { name: "Verification result" });
    // Selected panels retain removal; accepted replacements also invalidate completed results.
    const remove = screen.getByRole("button", { name: i18n.t("credential.issue.preview.remove") });
    await user.click(remove);
    fireEvent.drop(
      screen.getByRole("button", { name: i18n.t("credential.issue.preview.dragDrop") }),
      {
        dataTransfer: {
          files: [new File(["bad"], "bad.exe", { type: "application/octet-stream" })],
        },
      },
    );
    expect(screen.getByRole("alert")).toBeVisible();
    await user.upload(
      container.querySelector('input[type="file"]')!,
      new File(["new"], "second.png", { type: "image/png" }),
    );
    expect(screen.getByText("second.png")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Verification result" })).not.toBeInTheDocument();
  });

  it("ignores HTTP completion after pending file removal", async () => {
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requestStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    server.use(
      http.post("*/api/credentials/verify", async () => {
        started();
        await pending;
        return HttpResponse.json({ code: 400401, data: exact });
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<VerifyCredential />, { wrapper: TestProviders });
    await user.upload(
      container.querySelector('input[type="file"]')!,
      new File(["synthetic"], "pending.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /Verify Document/i }));
    await requestStarted;
    await user.click(
      screen.getByRole("button", { name: i18n.t("credential.issue.preview.remove") }),
    );
    await act(async () => {
      release();
      await pending;
    });
    expect(screen.queryByRole("heading", { name: "Verification result" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Document/i })).toBeDisabled();
  });
  it.each([
    { name: "live exact", status: 200, code: 400401, data: exact, publicAccess: true },
    {
      name: "AI similarity 100%",
      status: 200,
      code: 400404,
      data: {
        ...exact,
        verdict_code: 400404,
        similarity_score: 1,
        exact_match_confirmed: false,
        public_details: null,
      },
      publicAccess: false,
    },
    {
      name: "cached authentic",
      status: 200,
      code: 400401,
      data: { ...exact, exact_match_confirmed: false, public_details: null },
      publicAccess: false,
    },
    {
      name: "integrity verdict",
      status: 409,
      code: 400403,
      data: { ...exact, verdict_code: 400403, exact_match_confirmed: false, public_details: null },
      publicAccess: false,
    },
    { name: "chain unavailable", status: 503, code: 400447, data: null, publicAccess: false },
  ])(
    "handles $name through real client without protected requests",
    async ({ status, code, data, publicAccess }) => {
      let protectedCalls = 0;
      server.use(
        http.post("*/api/credentials/verify", () => {
          return HttpResponse.json({ code, data }, { status });
        }),
        http.get("*/api/*", () => {
          protectedCalls++;
          return new HttpResponse(null, { status: 403 });
        }),
      );
      const user = userEvent.setup();
      const { container } = render(<VerifyCredential />, { wrapper: TestProviders });
      await user.upload(
        container.querySelector('input[type="file"]')!,
        new File(["%PDF-1.4 synthetic test"], "synthetic.pdf", { type: "application/pdf" }),
      );
      await user.click(screen.getByRole("button", { name: /Verify Document/i }));
      if (status === 503) {
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(
          screen.queryByRole("heading", { name: "Verification result" }),
        ).not.toBeInTheDocument();
      } else {
        await screen.findByRole("heading", { name: "Verification result" });
        expect(Boolean(screen.queryByRole("button", { name: "View credential details" }))).toBe(
          publicAccess,
        );
      }
      if (publicAccess) {
        await user.click(screen.getByRole("button", { name: "View credential details" }));
        expect(screen.getByRole("dialog")).toHaveTextContent("Synthetic School");
        expect(screen.getByRole("dialog")).toHaveTextContent("Public Synthetic Holder");
        expect(screen.getByRole("dialog")).toHaveTextContent("Synthetic Unit");
      }
      expect(protectedCalls).toBe(0);
    },
  );

  it.each([
    { role: Role.HOLDER, owner: true, candidate: false, privateAccess: true },
    { role: Role.ISSUER, owner: false, candidate: false, privateAccess: true },
    { role: Role.ADMIN, owner: false, candidate: false, privateAccess: true },
    { role: Role.SUPER_ADMIN, owner: false, candidate: false, privateAccess: true },
    { role: Role.HOLDER, owner: false, candidate: false, privateAccess: false },
    { role: Role.ISSUER, owner: false, candidate: true, privateAccess: true },
    { role: Role.HOLDER, owner: true, candidate: true, privateAccess: true },
    { role: Role.HOLDER, owner: false, candidate: true, privateAccess: false },
  ])(
    "routes $role owner=$owner candidate=$candidate through existing access",
    async ({ role, owner, candidate, privateAccess }) => {
      useStore.setState({ user: makeUser({ id: "viewer", role }), isAuthenticated: true });
      const paths: string[] = [];
      let fileCalls = 0;
      let detailCalls = 0;
      const record = makeCredential({
        id: credential.id,
        name: credential.name,
        holder_user_id: owner ? "viewer" : "other",
        holder: makeUser({ name: "Private Synthetic Holder" }),
        file_uri: "/stored-file",
      });
      server.use(
        http.post("*/api/credentials/verify", () =>
          HttpResponse.json({
            code: candidate ? 400404 : 400401,
            data: candidate
              ? {
                  ...exact,
                  verdict_code: 400404,
                  exact_match_confirmed: false,
                  public_details: null,
                  similarity_score: 1,
                }
              : exact,
          }),
        ),
        http.get("*/api/credentials/:id/file", () => {
          fileCalls++;
          return new HttpResponse("protected candidate bytes", {
            headers: { "Content-Type": "image/png" },
          });
        }),
        http.get("*/api/credentials/:id", ({ request }) => respond(request)),
        http.get("*/api/users/self/credentials/:id", ({ request }) => respond(request)),
      );
      function respond(request: Request) {
        paths.push(new URL(request.url).pathname);
        detailCalls++;
        return privateAccess
          ? HttpResponse.json({ code: 400100, data: record })
          : HttpResponse.json({ code: 400104, data: null }, { status: 403 });
      }
      const user = userEvent.setup();
      const { container } = render(<VerifyCredential />, { wrapper: TestProviders });
      await user.upload(
        container.querySelector('input[type="file"]')!,
        new File(["%PDF-1.4 synthetic"], "unmatched-upload.pdf", { type: "application/pdf" }),
      );
      await user.click(screen.getByRole("button", { name: /Verify Document/i }));
      await screen.findByRole("heading", { name: "Verification result" });
      await waitFor(() => expect(detailCalls).toBeGreaterThan(0));
      if (candidate && !privateAccess) {
        expect(
          screen.queryByRole("button", { name: /View (compared credential|credential details)/ }),
        ).not.toBeInTheDocument();
        expect(screen.getByText("100%")).toBeVisible();
      } else {
        const action = await screen.findByRole("button", {
          name: candidate ? "View compared credential" : "View credential details",
        });
        if (privateAccess) await waitFor(() => expect(action).toBeEnabled());
        // Exact access can appear before the protected lookup settles.
        if (privateAccess) await waitFor(() => expect(detailCalls).toBe(1));
        await user.click(action);
        await screen.findByText(
          privateAccess ? "Private Synthetic Holder" : "Public Synthetic Holder",
        );
        if (privateAccess) {
          await waitFor(() => expect(fileCalls).toBe(1));
          expect(screen.getByText("synthetic-diploma.png")).toBeInTheDocument();
          expect(screen.queryByText("unmatched-upload.pdf")).toBeInTheDocument();
          expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
        } else {
          expect(fileCalls).toBe(0);
          expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
        }
      }
      expect(
        paths.every(
          (path) =>
            path ===
            (role === Role.HOLDER
              ? "/api/users/self/credentials/public-record"
              : "/api/credentials/public-record"),
        ),
      ).toBe(true);
    },
  );
});
