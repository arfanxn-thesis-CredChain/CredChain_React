import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { makeCredential, makeUser } from "@/test/fixtures";
import { server } from "@/test/msw/server";
import { useCredential } from "./useCredential";
import { useCredentialFile } from "./useCredentialFile";

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("credential session isolation", () => {
  it("does not reuse another identity's protected credential cache", async () => {
    useStore.setState({
      user: makeUser({ id: "issuer", role: Role.ISSUER }),
      isAuthenticated: true,
    });
    let selfCalls = 0;
    server.use(
      http.get("*/api/credentials/record", () =>
        HttpResponse.json({
          code: 400101,
          data: makeCredential({ id: "record", name: "Private issuer record" }),
        }),
      ),
      http.get("*/api/users/self/credentials/record", () => {
        selfCalls++;
        return HttpResponse.json({ code: 400144 }, { status: 404 });
      }),
    );
    const { result } = renderHook(() => useCredential("record"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.name).toBe("Private issuer record"));
    act(() => useStore.setState({ user: makeUser({ id: "unrelated", role: Role.HOLDER }) }));
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(selfCalls).toBe(1);
  });

  it("does not reuse another identity's protected file cache", async () => {
    useStore.setState({
      user: makeUser({ id: "issuer", role: Role.ISSUER }),
      isAuthenticated: true,
    });
    let calls = 0;
    server.use(
      http.get("*/api/credentials/record/file", () => {
        calls++;
        return calls === 1
          ? new HttpResponse("private stored bytes", { headers: { "Content-Type": "text/plain" } })
          : new HttpResponse(null, { status: 403 });
      }),
    );
    const { result } = renderHook(() => useCredentialFile("record", true), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => useStore.setState({ user: makeUser({ id: "unrelated", role: Role.HOLDER }) }));
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls).toBe(2);
  });
});
