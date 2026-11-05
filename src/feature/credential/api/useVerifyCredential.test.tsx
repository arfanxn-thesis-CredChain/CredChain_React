import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useVerifyCredential } from "./useVerifyCredential";

const file = new File(["%PDF-1.4"], "test.pdf", { type: "application/pdf" });
const integrity = {
  verdict_code: 400403,
  description: "Record mismatch",
  credential: {
    id: "c1",
    name: "Certificate",
    status: "approved",
    is_submission: false,
    issuer_organization_id: "org",
    issuer_organization_name: "Actual linked school",
    credential_type_name: "Diploma",
    number: null,
    file_hash: "0xabc",
    issued_at: "2026-01-01T00:00:00Z",
    expires_at: null,
  },
};

describe("useVerifyCredential", () => {
  it("recovers the structured integrity verdict from real HTTP409", async () => {
    server.use(
      http.post("*/api/credentials/verify", () =>
        HttpResponse.json({ code: 400403, data: integrity }, { status: 409 }),
      ),
    );
    const { result } = renderHook(() => useVerifyCredential(), { wrapper: TestProviders });
    await act(async () => {
      await expect(result.current.mutateAsync(file)).resolves.toMatchObject(integrity);
    });
  });

  it.each([
    { status: 409, body: { code: 400345, data: integrity } },
    { status: 409, body: { code: 400403, data: { ...integrity, credential: { id: "c1" } } } },
    { status: 409, body: { code: 400403, data: { ...integrity, verdict_code: 400401 } } },
    { status: 409, body: { code: 400403, data: { ...integrity, exact_match_confirmed: true } } },
    {
      status: 409,
      body: { code: 400403, data: { ...integrity, public_details: integrity.credential } },
    },
    { status: 503, body: { code: 400447 } },
  ])("rejects non-verdict or malformed response $status / $body.code", async ({ status, body }) => {
    server.use(http.post("*/api/credentials/verify", () => HttpResponse.json(body, { status })));
    const { result } = renderHook(() => useVerifyCredential(), { wrapper: TestProviders });
    await act(async () => {
      await expect(result.current.mutateAsync(file)).rejects.toBeInstanceOf(Error);
    });
  });

  it("rejects network failures", async () => {
    server.use(http.post("*/api/credentials/verify", () => HttpResponse.error()));
    const { result } = renderHook(() => useVerifyCredential(), { wrapper: TestProviders });
    await act(async () => {
      await expect(result.current.mutateAsync(file)).rejects.toBeInstanceOf(Error);
    });
  });
});
