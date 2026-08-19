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
import { useUpdateCredentials, type CredentialUpdateItem } from "./useUpdateCredentials";

afterEach(() => {
  vi.restoreAllMocks();
});

function Harness({ items }: { items: CredentialUpdateItem[] }) {
  const update = useUpdateCredentials();
  return <button onClick={() => update.mutate(items)}>update</button>;
}

describe("useUpdateCredentials", () => {
  it("posts { credentials: items } to PUT /credentials/batch", async () => {
    let recordedBody: unknown;
    server.use(
      http.put("*/api/credentials/batch", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401400, message: "ok", data: [] });
      }),
    );

    const user = userEvent.setup();
    render(
      <Harness
        items={[
          { id: "cred_1", name: "Updated", type_id: "ctype_01" },
          { id: "cred_2", number: "N-2" },
        ]}
      />,
      { wrapper: TestProviders },
    );

    await user.click(screen.getByRole("button", { name: "update" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({
        credentials: [
          { id: "cred_1", name: "Updated", type_id: "ctype_01" },
          { id: "cred_2", number: "N-2" },
        ],
      }),
    );
  });

  it("invalidates credential queries and toasts success on success", async () => {
    let refetches = 0;
    const successSpy = vi.spyOn(notify, "success");
    server.use(
      http.put("*/api/credentials/batch", () =>
        HttpResponse.json({ code: 401400, message: "ok", data: [] }),
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
      const update = useUpdateCredentials();
      return (
        <button onClick={() => update.mutate([{ id: "cred_pending_1", name: "X" }])}>update</button>
      );
    }

    const user = userEvent.setup();
    render(<ObserveAndAct />, { wrapper: TestProviders });
    await waitFor(() => expect(refetches).toBe(1));

    await user.click(screen.getByRole("button", { name: "update" }));

    await waitFor(() => expect(refetches).toBe(2));
    expect(successSpy).toHaveBeenCalledWith("success_credential_update");
  });

  it("surfaces the backend messageKey via notify.error on failure", async () => {
    const errorSpy = vi.spyOn(notify, "error");
    server.use(
      http.put("*/api/credentials/batch", () =>
        HttpResponse.json(
          { code: 401441, message: "Only pending credentials can be updated." },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    render(<Harness items={[{ id: "cred_1", name: "X" }]} />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "update" }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("error_credential_update_not_pending"));
  });

  it("falls back to a generic error key when the failure is not an API error", async () => {
    const errorSpy = vi.spyOn(notify, "error");
    vi.spyOn(api, "put").mockRejectedValue(new Error("network down"));

    const user = userEvent.setup();
    render(<Harness items={[{ id: "cred_1", name: "X" }]} />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "update" }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("cred.detail.updateFailed"));
  });
});
