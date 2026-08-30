import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosError, AxiosResponse } from "axios";
import { i18n } from "@shared/i18n/config";
import { TestProviders } from "@/test/TestProviders";
import { api } from "@shared/api/client";
import { ApiError, type ApiErrorResponse } from "@shared/api/envelope";
import { CredentialSubmit } from "./CredentialSubmit";

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
  fireEvent.change(
    screen.getByPlaceholderText("Credential name, or leave empty to use filename"),
    { target: { value: "Bachelor's Degree" } },
  );

  const comboboxes = screen.getAllByRole("combobox");

  await userEvent.click(comboboxes[0]);
  await userEvent.click(await screen.findByText("Bachelor's Degree"));

  await userEvent.click(screen.getAllByRole("combobox")[1]);
  await userEvent.click(await screen.findByText("University of Indonesia"));

  const dateInputs = container.querySelectorAll('input[type="date"]');
  fireEvent.change(dateInputs[0], { target: { value: "2024-01-15" } });

  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [makePdf()] } });
}

describe("CredentialSubmit", () => {
  function renderPage() {
    return render(
      <TestProviders routePath="/credentials/submit" initialEntries={["/credentials/submit"]}>
        <CredentialSubmit />
      </TestProviders>,
    );
  }

  it("submits a batch when required fields are filled", async () => {
    const postSpy = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: [] } as unknown as AxiosResponse);

    const { container } = renderPage();

    await fillRequiredFields(container);

    fireEvent.click(screen.getByRole("button", { name: "Submit Credentials" }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalled();
    });

    expect(postSpy.mock.calls[0][0]).toBe("/credentials/batch/submit");
    const formData = postSpy.mock.calls[0][1] as FormData;
    expect(formData.get("credentials[0][name]")).toBe("Bachelor's Degree");
    expect(formData.get("credentials[0][type_id]")).toBe("ctype_01");
    expect(formData.get("credentials[0][issuer_organization_id]")).toBe("iorg_01");
    expect(formData.get("credentials[0][issued_at]")).toBe("2024-01-15");
    expect(formData.has("credentials[0][holder_user_id]")).toBe(false);
  });

  it("auto-fills the name from the uploaded filename unless one was typed first", async () => {
    const { container } = renderPage();
    const nameInput = screen.getByPlaceholderText(
      "Credential name, or leave empty to use filename",
    ) as HTMLInputElement;
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [makePdf()] } });
    await waitFor(() => {
      expect(nameInput.value).toBe("diploma");
    });

    // Typing a name first must suppress the auto-fill on the next upload.
    fireEvent.change(nameInput, { target: { value: "My Custom Name" } });
    fireEvent.change(fileInput, {
      target: { files: [new File(["%PDF-1.4"], "other.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => {
      expect(nameInput.value).toBe("My Custom Name");
    });
  });

  it("shows a server error under the matching row", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(422, 100040, "system.validation", {} as AxiosError<ApiErrorResponse>, {
        "credentials.0.file": ["File is required"],
      }),
    );

    const { container } = renderPage();

    await fillRequiredFields(container);

    fireEvent.click(screen.getByRole("button", { name: "Submit Credentials" }));

    expect(await screen.findByText("File is required")).toBeInTheDocument();
  });

  it("blocks submission when required fields are missing", async () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Submit Credentials" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(await screen.findByText("Credential type is required")).toBeInTheDocument();
    expect(await screen.findByText("Issuer organization is required")).toBeInTheDocument();
    expect(await screen.findByText("Issued date is required")).toBeInTheDocument();
    expect(await screen.findByText("File is required")).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });
});
