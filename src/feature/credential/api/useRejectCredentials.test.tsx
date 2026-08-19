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
import { useRejectCredentials } from "./useRejectCredentials";

afterEach(() => {
  vi.restoreAllMocks();
});

const rejections = [{ id: "cred_1", reason: "Missing document" }];

function Harness({ items = rejections }: { items?: { id: string; reason: string }[] }) {
  const reject = useRejectCredentials();
  return <button onClick={() => reject.mutate(items)}>reject</button>;
}

describe("useRejectCredentials", () => {
  it("posts { rejections } to /credentials/batch/reject", async () => {
    let recordedBody: unknown;
    server.use(
      http.post("*/api/credentials/batch/reject", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401200, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    render(
      <Harness
        items={[
          { id: "cred_1", reason: "Duplicate" },
          { id: "cred_2", reason: "Unreadable file" },
        ]}
      />,
      { wrapper: TestProviders },
    );

    await user.click(screen.getByRole("button", { name: "reject" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({
        rejections: [
          { id: "cred_1", reason: "Duplicate" },
          { id: "cred_2", reason: "Unreadable file" },
        ],
      }),
    );
  });

  it("invalidates credential queries and toasts success on success", async () => {
    let refetches = 0;
    const successSpy = vi.spyOn(notify, "success");
    server.use(
      http.post("*/api/credentials/batch/reject", () =>
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
      const reject = useRejectCredentials();
      return <button onClick={() => reject.mutate(rejections)}>reject</button>;
    }

    const user = userEvent.setup();
    render(<ObserveAndAct />, { wrapper: TestProviders });
    await waitFor(() => expect(refetches).toBe(1));

    await user.click(screen.getByRole("button", { name: "reject" }));

    await waitFor(() => expect(refetches).toBe(2));
    expect(successSpy).toHaveBeenCalledWith("cred.reject.success");
  });

  it("surfaces the backend messageKey via notify.error on failure", async () => {
    const errorSpy = vi.spyOn(notify, "error");
    server.use(
      http.post("*/api/credentials/batch/reject", () =>
        HttpResponse.json(
          { code: 401243, message: "One or more credentials are already revoked." },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    render(<Harness />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "reject" }));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith("error_credential_review_already_revoked"),
    );
  });

  it("falls back to a generic error key when the failure is not an API error", async () => {
    const errorSpy = vi.spyOn(notify, "error");
    vi.spyOn(api, "post").mockRejectedValue(new Error("network down"));

    const user = userEvent.setup();
    render(<Harness />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "reject" }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("cred.reject.failed"));
  });
});
