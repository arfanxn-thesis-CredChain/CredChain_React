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
import { useLinkCompetencies } from "./useLinkCompetencies";

afterEach(() => {
  vi.restoreAllMocks();
});

function Harness() {
  const link = useLinkCompetencies();
  return (
    <button
      onClick={() =>
        link.mutate({ credentialId: "cred_1", competencyIds: ["comp_01", "comp_02"] })
      }
    >
      link
    </button>
  );
}

describe("useLinkCompetencies", () => {
  it("posts { competency_ids } to PUT /credentials/:id/competencies", async () => {
    let recordedUrl = "";
    let recordedBody: unknown;
    server.use(
      http.put("*/api/credentials/:id/competencies", async ({ request }) => {
        recordedUrl = request.url;
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401300, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    render(<Harness />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "link" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({ competency_ids: ["comp_01", "comp_02"] }),
    );
    expect(recordedUrl).toContain("/credentials/cred_1/competencies");
  });

  it("invalidates credential queries and toasts success on success", async () => {
    let refetches = 0;
    const successSpy = vi.spyOn(notify, "success");
    server.use(
      http.put("*/api/credentials/:id/competencies", () =>
        HttpResponse.json({ code: 401300, message: "ok", data: null }),
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
      const link = useLinkCompetencies();
      return (
        <button
          onClick={() => link.mutate({ credentialId: "cred_1", competencyIds: [] })}
        >
          link
        </button>
      );
    }

    const user = userEvent.setup();
    render(<ObserveAndAct />, { wrapper: TestProviders });
    await waitFor(() => expect(refetches).toBe(1));

    await user.click(screen.getByRole("button", { name: "link" }));

    await waitFor(() => expect(refetches).toBe(2));
    expect(successSpy).toHaveBeenCalledWith("success_credential_competency_link");
  });

  it("surfaces the backend messageKey via notify.error on failure", async () => {
    const errorSpy = vi.spyOn(notify, "error");
    server.use(
      http.put("*/api/credentials/:id/competencies", () =>
        HttpResponse.json(
          { code: 401341, message: "One or more competencies were not found." },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    render(<Harness />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "link" }));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith("error_credential_competency_link_competency_not_found"),
    );
  });

  it("falls back to a generic error key when the failure is not an API error", async () => {
    const errorSpy = vi.spyOn(notify, "error");
    vi.spyOn(api, "put").mockRejectedValue(new Error("network down"));

    const user = userEvent.setup();
    render(<Harness />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "link" }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("cred.competency.linkFailed"));
  });
});
