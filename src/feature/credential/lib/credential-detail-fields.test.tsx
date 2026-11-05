import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "@/test/TestProviders";
import { makeCredential } from "@/test/fixtures";
import { i18n } from "@shared/i18n/config";
import { buildCredentialReadFields } from "./credential-detail-fields";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("buildCredentialReadFields", () => {
  it("preserves original labels, order and full-width fields", () => {
    const fields = buildCredentialReadFields(makeCredential(), i18n.t, "en");
    expect(fields.map((field) => field.key)).toEqual([
      "name",
      "number",
      "type_id",
      "issuer_organization_id",
      "issued_at",
      "expires_at",
      "competencies",
      "meta",
    ]);
    expect(fields.map((field) => field.label)).toEqual([
      "Name",
      "Number",
      "Credential type",
      "Issuer organization",
      "Issued date",
      "Expiry date",
      "Competencies",
      "Additional Information",
    ]);
    expect(fields.filter((field) => field.fullWidth).map((field) => field.key)).toEqual([
      "competencies",
      "meta",
    ]);
    expect(fields.every((field) => field.editControl === null)).toBe(true);
  });

  it("prefers resolved names, retains staged labels and private ID fallback", () => {
    const fields = buildCredentialReadFields(
      makeCredential({
        type: { id: "type", name: "Resolved type", active: true },
        submitted_type_name: "Old staged type",
        submitted_issuer_organization_name: "Proposed organization",
      }),
      i18n.t,
      "en",
    );
    const view = render(
      <>
        {fields.map((field) => (
          <div key={field.key}>{field.readValue}</div>
        ))}
      </>,
      { wrapper: TestProviders },
    );
    expect(screen.getByText("Resolved type")).toBeInTheDocument();
    expect(screen.queryByText("Old staged type")).not.toBeInTheDocument();
    expect(screen.getByText("Proposed organization")).toBeInTheDocument();
    view.unmount();
    const fallback = buildCredentialReadFields(makeCredential(), i18n.t, "en");
    render(<>{fallback.find((field) => field.key === "type_id")?.readValue}</>, {
      wrapper: TestProviders,
    });
    expect(screen.getByText(/type_test/)).toBeInTheDocument();
  });

  it.each(["competencies", "competency"])(
    "retains %s metadata fallback with escaped values",
    (key) => {
      const fields = buildCredentialReadFields(
        makeCredential({
          competencies: [],
          meta: { [key]: ["  Design  ", "", 42], note: "<script>synthetic</script>" },
        }),
        i18n.t,
        "en",
      );
      const { container } = render(
        <>
          {fields.map((field) => (
            <div key={field.key}>{field.readValue}</div>
          ))}
        </>,
        { wrapper: TestProviders },
      );
      expect(screen.getByText("Design")).toBeInTheDocument();
      expect(screen.getByText("<script>synthetic</script>")).toBeInTheDocument();
      expect(container.querySelector("script")).toBeNull();
    },
  );

  it("prefers linked competencies over metadata fallback", () => {
    const fields = buildCredentialReadFields(
      makeCredential({
        competencies: [{ id: "linked", name: "Linked skill", active: true }],
        meta: { competency: "Fallback skill" },
      }),
      i18n.t,
      "en",
    );
    render(<>{fields.find((field) => field.key === "competencies")?.readValue}</>, {
      wrapper: TestProviders,
    });
    expect(screen.getByText("Linked skill")).toBeInTheDocument();
    expect(screen.queryByText("Fallback skill")).not.toBeInTheDocument();
  });
});
