import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { AxiosResponse } from "axios";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import { api } from "@shared/api/client";
import { useIssueCredentials } from "./useIssueCredentials";

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

describe("useIssueCredentials", () => {
  it("sets server errors on validation failure", async () => {
    server.use(
      http.post("*/api/credentials/batch/issue", () => {
        return HttpResponse.json(
          {
            code: 100040,
            message: "system.validation",
            errors: {
              "credentials[0].name": ["credential.nameRequired"],
            },
          },
          { status: 422 },
        );
      }),
    );

    const form = createFormMock();
    const { result } = renderHook(() => useIssueCredentials(form), {
      wrapper: TestProviders,
    });

    result.current.mutate([
      {
        holder_user_id: "usr_01",
        type_id: "ctype_01",
        issuer_organization_id: "iorg_01",
        number: "",
        issued_at: "",
        expires_at: "",
        competency_ids: [],
        name: "whatever",
        meta_entries: [],
        file: null,
      },
    ]);

    await waitFor(() => {
      expect(form.setError).toHaveBeenCalledWith(
        "credentials[0].name",
        expect.objectContaining({ type: "server", message: "credential.nameRequired" }),
      );
    });

    expect(result.current.isError).toBe(true);
  });

  it("shows success on valid input", async () => {
    const form = createFormMock();
    const { result } = renderHook(() => useIssueCredentials(form), {
      wrapper: TestProviders,
    });

    result.current.mutate([
      {
        holder_user_id: "usr_01",
        type_id: "ctype_01",
        issuer_organization_id: "iorg_01",
        number: "",
        issued_at: "",
        expires_at: "",
        competency_ids: [],
        name: "OK",
        meta_entries: [],
        file: null,
      },
    ]);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("builds the multipart FormData shape (comma-joined competency_ids)", async () => {
    const postSpy = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: [] } as unknown as AxiosResponse);

    const form = createFormMock();
    const { result } = renderHook(() => useIssueCredentials(form), {
      wrapper: TestProviders,
    });

    const file = new File(["%PDF-1.4"], "diploma.pdf", { type: "application/pdf" });
    result.current.mutate([
      {
        holder_user_id: "usr_4",
        type_id: "ctype_01",
        issuer_organization_id: "iorg_01",
        issued_at: "2024-01-15",
        number: "S-123",
        expires_at: "2030-01-15",
        competency_ids: ["comp_01", "comp_02"],
        meta_entries: [{ key: "program", value: "Computer Science" }],
        name: "Bachelor's Degree",
        file,
      },
    ]);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(postSpy).toHaveBeenCalledWith(
      "/credentials/batch/issue",
      expect.any(FormData),
      expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } }),
    );

    const formData = postSpy.mock.calls[0][1] as FormData;
    expect(formData.get("credentials[0][holder_user_id]")).toBe("usr_4");
    expect(formData.get("credentials[0][type_id]")).toBe("ctype_01");
    expect(formData.get("credentials[0][issuer_organization_id]")).toBe("iorg_01");
    expect(formData.get("credentials[0][number]")).toBe("S-123");
    expect(formData.get("credentials[0][issued_at]")).toBe("2024-01-15");
    expect(formData.get("credentials[0][expires_at]")).toBe("2030-01-15");
    expect(formData.get("credentials[0][name]")).toBe("Bachelor's Degree");
    expect(formData.get("credentials[0][competency_ids]")).toBe("comp_01,comp_02");
    expect(formData.get("credentials[0][meta]")).toBe('{"program":"Computer Science"}');
    const uploaded = formData.get("credentials[0][file]");
    expect(uploaded instanceof File).toBe(true);
    expect((uploaded as File).name).toBe("diploma.pdf");
  });

  it("omits optional keys when empty", async () => {
    const postSpy = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: [] } as unknown as AxiosResponse);

    const form = createFormMock();
    const { result } = renderHook(() => useIssueCredentials(form), {
      wrapper: TestProviders,
    });

    result.current.mutate([
      {
        holder_user_id: "usr_4",
        type_id: "ctype_01",
        issuer_organization_id: "iorg_01",
        number: "",
        issued_at: "",
        expires_at: "",
        competency_ids: [],
        name: "Diploma",
        meta_entries: [],
        file: new File(["x"], "d.pdf", { type: "application/pdf" }),
      },
    ]);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const formData = postSpy.mock.calls[0][1] as FormData;
    expect(formData.get("credentials[0][type_id]")).toBe("ctype_01");
    expect(formData.get("credentials[0][issuer_organization_id]")).toBe("iorg_01");
    expect(formData.has("credentials[0][number]")).toBe(false);
    expect(formData.has("credentials[0][issued_at]")).toBe(false);
    expect(formData.has("credentials[0][expires_at]")).toBe(false);
    expect(formData.has("credentials[0][competency_ids]")).toBe(false);
    expect(formData.has("credentials[0][meta]")).toBe(false);
  });
});
