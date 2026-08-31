import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { useResolveMetadata } from "./useResolveMetadata";

afterEach(() => {
  vi.restoreAllMocks();
});

function Harness() {
  const resolve = useResolveMetadata();
  return (
    <button
      onClick={() =>
        resolve.mutate({
          credentialId: "cred_1",
          typeId: "01JTYPE",
          createCompetencyNames: ["Discrete Math"],
        })
      }
    >
      resolve
    </button>
  );
}

describe("useResolveMetadata", () => {
  it("PUTs only the present fields as snake_case, omitting undefined", async () => {
    let recordedBody: unknown;
    server.use(
      http.put("*/api/credentials/:id/metadata", async ({ request }) => {
        recordedBody = await request.json();
        return HttpResponse.json({ code: 401500, message: "ok", data: null });
      }),
    );

    const user = userEvent.setup();
    render(<Harness />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: "resolve" }));

    await waitFor(() =>
      expect(recordedBody).toEqual({
        type_id: "01JTYPE",
        create_competency_names: ["Discrete Math"],
      }),
    );
  });
});
