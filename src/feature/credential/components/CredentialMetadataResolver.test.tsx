import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { i18n } from "@shared/i18n/config";
import type { CredentialMetadataSuggestionsDTO } from "@shared/types/api";
import { CredentialMetadataResolver } from "./CredentialMetadataResolver";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

const suggestions: CredentialMetadataSuggestionsDTO = {
  credential_id: "01JCRED",
  type: {
    submitted_name: "Micro-credential",
    matches: [{ id: "01JTYPE", name: "Microcredential", active: true }],
  },
  organization: null,
  competencies: [
    {
      submitted_name: "Discrete Math",
      matches: [{ id: "01JCOMP", name: "Discrete Mathematics", active: true }],
    },
  ],
};

function renderResolver() {
  return render(<CredentialMetadataResolver credentialId="01JCRED" />, {
    wrapper: TestProviders,
  });
}

describe("CredentialMetadataResolver", () => {
  it("links a suggested match", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/credentials/:id/metadata/suggestions", () =>
        HttpResponse.json({ code: 401501, message: "ok", data: suggestions }),
      ),
    );
    let body: unknown;
    server.use(
      http.put("*/api/credentials/:id/metadata", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ code: 401500, message: "ok", data: null });
      }),
    );

    renderResolver();

    await user.click(await screen.findByRole("button", { name: /Microcredential/ }));
    await user.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => expect(body).toEqual({ type_id: "01JTYPE" }));
  });

  it("creates the name as typed when no match fits", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/credentials/:id/metadata/suggestions", () =>
        HttpResponse.json({ code: 401501, message: "ok", data: suggestions }),
      ),
    );
    let body: unknown;
    server.use(
      http.put("*/api/credentials/:id/metadata", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ code: 401500, message: "ok", data: null });
      }),
    );

    renderResolver();

    await user.click(await screen.findByRole("button", { name: /Micro-credential/ }));
    await user.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => expect(body).toEqual({ create_type_name: "Micro-credential" }));
  });
});
