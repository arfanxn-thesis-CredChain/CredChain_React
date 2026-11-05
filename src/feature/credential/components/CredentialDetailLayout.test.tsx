import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TestProviders } from "@/test/TestProviders";
import { CredentialDetailLayout } from "./CredentialDetailLayout";

describe("CredentialDetailLayout", () => {
  it("preserves original shell and file, notices, details, parties, footer order", () => {
    render(
      <CredentialDetailLayout
        title="Credential"
        open
        onOpenChange={() => {}}
        filePanel={<p>File panel</p>}
        notices={<p>Notice</p>}
        details={<p>Details slot</p>}
        parties={<p>Parties</p>}
        footer={<p>Footer</p>}
      />,
      { wrapper: TestProviders },
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-5xl", "p-6", "sm:p-8");
    expect(Array.from(dialog.querySelectorAll("p")).map((item) => item.textContent)).toEqual([
      "Detail",
      "File panel",
      "Notice",
      "Details slot",
      "Parties",
      "Footer",
    ]);
  });
});
