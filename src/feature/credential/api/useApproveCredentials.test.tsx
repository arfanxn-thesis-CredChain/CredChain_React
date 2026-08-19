import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { credentialKeys } from "./keys";
import { useApproveCredentials } from "./useApproveCredentials";

afterEach(() => {
  vi.restoreAllMocks();
});

function Harness({ ids = ["cred_pending_1"] }: { ids?: string[] }) {
  const approve = useApproveCredentials();
  return <button onClick={() => approve.mutate(ids)}>approve</button>;
}

describe("useApproveCredentials", () => {
  it("posts { ids } to /credentials/batch/approve", async () => {
    let recordedBody: unknown;
    server.use(
      http.post("*/api/credentials/batch/approve", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    render(<Harness ids={["cred_1", "cred_2"]} />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "approve" }));

    await waitFor(() => expect(recordedBody).toEqual({ ids: ["cred_1", "cred_2"] }));
    expect(screen.getByRole("button", { name: "approve" })).toBeEnabled();
  });

  it("invalidates credential queries and toasts success on success", async () => {
    let refetches = 0;
    const successSpy = vi.spyOn(notify, "success");
    server.use(
      http.post("*/api/credentials/batch/approve", () =>
        HttpResponse.json({ code: 401200, message: "ok", data: [] }),
      ),
    );

    function ObserveAndAct() {
      useQuery({
        queryKey: credentialKeys.all(),
        queryFn: async () => {
          refetches += 1;
          return "data";
        },
      });
      const approve = useApproveCredentials();
      return <button onClick={() => approve.mutate(["cred_pending_1"])}>approve</button>;
    }

    const user = userEvent.setup();
    render(<ObserveAndAct />, { wrapper: TestProviders });
    await waitFor(() => expect(refetches).toBe(1));

    await user.click(screen.getByRole("button", { name: "approve" }));

    await waitFor(() => expect(refetches).toBe(2));
    expect(successSpy).toHaveBeenCalledWith("cred.approve.success");
  });

  it("surfaces the backend messageKey via notify.error on failure", async () => {
    const errorSpy = vi.spyOn(notify, "error");
    server.use(
      http.post("*/api/credentials/batch/approve", () =>
        HttpResponse.json(
          { code: 401244, message: "Failed to sync credential review to the blockchain." },
          { status: 500 },
        ),
      ),
    );

    const user = userEvent.setup();
    render(<Harness />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "approve" }));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith("error_credential_review_blockchain_sync_failed"),
    );
  });

  it("falls back to a generic error key when the failure is not an API error", async () => {
    const errorSpy = vi.spyOn(notify, "error");
    vi.spyOn(api, "post").mockRejectedValue(new Error("network down"));

    const user = userEvent.setup();
    render(<Harness />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "approve" }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("cred.approve.failed"));
  });
});
