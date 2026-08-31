import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { setServerErrors } from "@shared/lib/forms";
import { mergeMeta } from "@shared/lib/meta";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import type { CredentialSubmitRowInput } from "../schemas/credential";
import { credentialKeys } from "./keys";

const BACKEND_TO_FRONTEND_PATH: Record<string, string> = {
  Credentials: "credentials",
  Name: "name",
  TypeID: "type_id",
  SubmittedTypeName: "submitted_type_name",
  IssuerOrganizationID: "issuer_organization_id",
  SubmittedIssuerOrganizationName: "submitted_issuer_organization_name",
  Number: "number",
  IssuedAt: "issued_at",
  ExpiresAt: "expires_at",
  CompetencyIDs: "competency_ids",
  SubmittedCompetencyNames: "submitted_competency_names",
  Meta: "meta_entries",
  File: "file",
};

function normalizeBatchErrorPaths(errors: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [path, messages] of Object.entries(errors)) {
    const parts = path.split(".");
    const normalized = parts.map((p) => BACKEND_TO_FRONTEND_PATH[p] ?? p).join(".");
    out[normalized] = messages;
  }
  return out;
}

export function useSubmitCredentials<T extends FieldValues>(form?: UseFormReturn<T>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: CredentialSubmitRowInput[]) => {
      const formData = new FormData();
      rows.forEach((row, i) => {
        formData.append(`credentials[${i}][name]`, row.name);
        if (row.type_id) {
          formData.append(`credentials[${i}][type_id]`, row.type_id);
        }
        if (row.submitted_type_name) {
          formData.append(`credentials[${i}][submitted_type_name]`, row.submitted_type_name);
        }
        if (row.issuer_organization_id) {
          formData.append(`credentials[${i}][issuer_organization_id]`, row.issuer_organization_id);
        }
        if (row.submitted_issuer_organization_name) {
          formData.append(
            `credentials[${i}][submitted_issuer_organization_name]`,
            row.submitted_issuer_organization_name,
          );
        }
        formData.append(`credentials[${i}][issued_at]`, row.issued_at);
        if (row.number) {
          formData.append(`credentials[${i}][number]`, row.number);
        }
        if (row.expires_at) {
          formData.append(`credentials[${i}][expires_at]`, row.expires_at);
        }
        if (row.competency_ids && row.competency_ids.length > 0) {
          formData.append(`credentials[${i}][competency_ids]`, row.competency_ids.join(","));
        }
        if (row.submitted_competency_names && row.submitted_competency_names.length > 0) {
          row.submitted_competency_names.forEach((name) => {
            formData.append(`credentials[${i}][submitted_competency_names]`, name);
          });
        }
        if (row.meta_entries && row.meta_entries.length > 0) {
          const metaObj = mergeMeta(row.meta_entries, {});
          if (metaObj) {
            formData.append(`credentials[${i}][meta]`, JSON.stringify(metaObj));
          }
        }
        if (row.file) {
          formData.append(`credentials[${i}][file]`, row.file);
        }
      });
      await api.post("/credentials/batch/submit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
      notify.success("cred.submit.success");
    },
    onError: (error) => {
      if (isApiError(error) && error.fieldErrors && form) {
        setServerErrors(form, normalizeBatchErrorPaths(error.fieldErrors));
        void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
        notify.error("validation.form_errors");
      } else if (isApiError(error)) {
        notify.error(error.messageKey);
      } else {
        notify.error("cred.submit.submitError");
      }
    },
  });
}
