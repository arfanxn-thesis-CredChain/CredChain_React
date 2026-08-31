import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { AxiosResponse } from "axios";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import { api } from "@shared/api/client";
import { useSubmitCredentials } from "./useSubmitCredentials";

afterEach(() => {
  vi.restoreAllMocks();
});

function createFormMock(): UseFormReturn<FieldValues> {
  return {
    setError: vi.fn(),
    clearErrors: vi.fn(),
    setValue: vi.fn(),
    getValues: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    handleSubmit: vi.fn(),
    watch: vi.fn(),
    reset: vi.fn(),
    resetField: vi.fn(),
    setFocus: vi.fn(),
    trigger: vi.fn(),
    formState: {
      isDirty: false,
      dirtyFields: {},
      isSubmitted: false,
      isSubmitSuccessful: false,
      submitCount: 0,
      touchedFields: {},
      errors: {},
      isValidating: false,
      isValid: true,
      defaultValues: {},
    },
    control: {} as UseFormReturn<FieldValues>["control"],
    getFieldState: vi.fn(),
  } as unknown as UseFormReturn<FieldValues>;
}

function mockSubmitSuccess() {
  return vi.spyOn(api, "post").mockResolvedValue({ data: [] } as unknown as AxiosResponse);
}

describe("useSubmitCredentials", () => {
  it("builds the multipart FormData shape (comma-joined competency_ids, no holder key)", async () => {
    const postSpy = mockSubmitSuccess();

    const form = createFormMock();
    const { result } = renderHook(() => useSubmitCredentials(form), {
      wrapper: TestProviders,
    });

    const file = new File(["%PDF-1.4"], "diploma.pdf", { type: "application/pdf" });
    result.current.mutate([
      {
        name: "Bachelor's Degree",
        type_id: "ctype_01",
        issuer_organization_id: "iorg_01",
        issued_at: "2024-01-15",
        number: "S-123",
        expires_at: "2030-01-15",
        competency_ids: ["comp_01", "comp_02"],
        meta_entries: [{ key: "program", value: "Computer Science" }],
        file,
      },
    ]);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(postSpy).toHaveBeenCalledWith(
      "/credentials/batch/submit",
      expect.any(FormData),
      expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } }),
    );

    const formData = postSpy.mock.calls[0][1] as FormData;
    expect(formData.get("credentials[0][name]")).toBe("Bachelor's Degree");
    expect(formData.get("credentials[0][type_id]")).toBe("ctype_01");
    expect(formData.get("credentials[0][issuer_organization_id]")).toBe("iorg_01");
    expect(formData.get("credentials[0][issued_at]")).toBe("2024-01-15");
    expect(formData.get("credentials[0][number]")).toBe("S-123");
    expect(formData.get("credentials[0][expires_at]")).toBe("2030-01-15");
    expect(formData.get("credentials[0][competency_ids]")).toBe("comp_01,comp_02");
    expect(formData.get("credentials[0][meta]")).toBe('{"program":"Computer Science"}');
    expect(formData.has("credentials[0][holder_user_id]")).toBe(false);
    const uploaded = formData.get("credentials[0][file]");
    expect(uploaded instanceof File).toBe(true);
    expect((uploaded as File).name).toBe("diploma.pdf");
  });

  it("emits proposed metadata names (repeated competency names)", async () => {
    const postSpy = mockSubmitSuccess();

    const form = createFormMock();
    const { result } = renderHook(() => useSubmitCredentials(form), {
      wrapper: TestProviders,
    });

    result.current.mutate([
      {
        name: "Bootcamp Certificate",
        submitted_type_name: "Micro-credential",
        submitted_issuer_organization_name: "Cyfrin Updraft",
        issued_at: "2026-01-15",
        submitted_competency_names: ["Teamwork", "Solidity"],
        file: new File(["x"], "c.pdf", { type: "application/pdf" }),
      },
    ]);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const formData = postSpy.mock.calls[0][1] as FormData;
    expect(formData.get("credentials[0][submitted_type_name]")).toBe("Micro-credential");
    expect(formData.get("credentials[0][submitted_issuer_organization_name]")).toBe(
      "Cyfrin Updraft",
    );
    expect(formData.getAll("credentials[0][submitted_competency_names]")).toEqual([
      "Teamwork",
      "Solidity",
    ]);
    expect(formData.has("credentials[0][type_id]")).toBe(false);
    expect(formData.has("credentials[0][issuer_organization_id]")).toBe(false);
  });

  it("omits optional keys when empty", async () => {
    const postSpy = mockSubmitSuccess();

    const form = createFormMock();
    const { result } = renderHook(() => useSubmitCredentials(form), {
      wrapper: TestProviders,
    });

    result.current.mutate([
      {
        name: "Diploma",
        type_id: "ctype_01",
        issuer_organization_id: "iorg_01",
        issued_at: "2024-01-15",
        number: "",
        expires_at: "",
        competency_ids: [],
        meta_entries: [],
        file: new File(["x"], "d.pdf", { type: "application/pdf" }),
      },
    ]);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const formData = postSpy.mock.calls[0][1] as FormData;
    expect(formData.has("credentials[0][number]")).toBe(false);
    expect(formData.has("credentials[0][expires_at]")).toBe(false);
    expect(formData.has("credentials[0][competency_ids]")).toBe(false);
    expect(formData.has("credentials[0][meta]")).toBe(false);
  });

  it("maps backend error paths per row onto the form", async () => {
    server.use(
      http.post("*/api/credentials/batch/submit", () => {
        return HttpResponse.json(
          {
            code: 100040,
            message: "system.validation",
            errors: {
              "credentials.0.file": ["credential.fileRequired"],
            },
          },
          { status: 422 },
        );
      }),
    );

    const form = createFormMock();
    const { result } = renderHook(() => useSubmitCredentials(form), {
      wrapper: TestProviders,
    });

    result.current.mutate([
      {
        name: "Diploma",
        type_id: "ctype_01",
        issuer_organization_id: "iorg_01",
        issued_at: "2024-01-15",
        number: "",
        expires_at: "",
        competency_ids: [],
        meta_entries: [],
        file: null,
      },
    ]);

    await waitFor(() => {
      expect(form.setError).toHaveBeenCalledWith(
        "credentials.0.file",
        expect.objectContaining({ type: "server", message: "credential.fileRequired" }),
      );
    });

    expect(result.current.isError).toBe(true);
  });
});
