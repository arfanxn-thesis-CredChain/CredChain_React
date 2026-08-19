import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AxiosResponse } from "axios";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { api } from "@shared/api/client";
import { CredentialIssue } from "./CredentialIssue";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makePdf(): File {
  return new File(["%PDF-1.4"], "diploma.pdf", { type: "application/pdf" });
}

async function fillRequiredFields(container: HTMLElement) {
  const comboboxes = () => screen.getAllByRole("combobox");

  fireEvent.click(comboboxes()[0]);
  fireEvent.change(screen.getByPlaceholderText("Search holders..."), {
    target: { value: "Jane" },
  });
  fireEvent.click(await screen.findByText("Jane Doe", undefined, { timeout: 2000 }));

  fireEvent.change(screen.getByPlaceholderText("Credential name, or leave empty to use filename"), {
    target: { value: "Bachelor's Degree" },
  });

  fireEvent.click(comboboxes()[1]);
  fireEvent.click(await screen.findByText("Bachelor's Degree"));

  fireEvent.click(comboboxes()[2]);
  fireEvent.click(await screen.findByText("University of Indonesia"));

  const dateInputs = container.querySelectorAll('input[type="date"]');
  fireEvent.change(dateInputs[0], { target: { value: "2024-01-15" } });
  fireEvent.change(dateInputs[1], { target: { value: "2026-01-15" } });

  fireEvent.change(screen.getByPlaceholderText("Certificate / diploma number"), {
    target: { value: "S-123" },
  });

  fireEvent.click(comboboxes()[3]);
  fireEvent.click(await screen.findByText("Machine Learning"));
  fireEvent.click(await screen.findByText("Data Analysis"));
  fireEvent.keyDown(document.body, { key: "Escape" });

  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [makePdf()] } });
}

describe("CredentialIssue", () => {
  function renderPage() {
    return render(
      <TestProviders routePath="/credentials/issue" initialEntries={["/credentials/issue"]}>
        <CredentialIssue />
      </TestProviders>,
    );
  }

  it("submits a batch with holder, type, organization, number, dates, and competencies", async () => {
    const postSpy = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: [] } as unknown as AxiosResponse);

    const { container } = renderPage();

    await fillRequiredFields(container);

    fireEvent.click(screen.getByRole("button", { name: "Issue Credentials" }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalled();
    });

    expect(postSpy.mock.calls[0][0]).toBe("/credentials/batch/issue");
    const formData = postSpy.mock.calls[0][1] as FormData;
    expect(formData.get("credentials[0][holder_user_id]")).toBe("usr_4");
    expect(formData.get("credentials[0][type_id]")).toBe("ctype_01");
    expect(formData.get("credentials[0][issuer_organization_id]")).toBe("iorg_01");
    expect(formData.get("credentials[0][number]")).toBe("S-123");
    expect(formData.get("credentials[0][issued_at]")).toBe("2024-01-15");
    expect(formData.get("credentials[0][expires_at]")).toBe("2026-01-15");
    expect(formData.get("credentials[0][name]")).toBe("Bachelor's Degree");
    expect(formData.get("credentials[0][competency_ids]")).toBe("comp_01,comp_02");
    const uploaded = formData.get("credentials[0][file]");
    expect(uploaded instanceof File).toBe(true);
    expect((uploaded as File).name).toBe("diploma.pdf");
  });

  it("blocks submission when required fields are missing", async () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Issue Credentials" }));

    expect(await screen.findByText("Holder is required")).toBeInTheDocument();
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(await screen.findByText("Credential type is required")).toBeInTheDocument();
    expect(await screen.findByText("Issuer organization is required")).toBeInTheDocument();
    expect(await screen.findByText("File is required")).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });
});
