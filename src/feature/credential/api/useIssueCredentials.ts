import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { setServerErrors } from "@shared/lib/forms";
import { mergeMeta } from "@shared/lib/meta";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import type { CredentialIssueRowInput } from "../schemas/credential";
import { credentialKeys } from "./keys";

const BACKEND_TO_FRONTEND_PATH: Record<string, string> = {
  Credentials: "credentials",
  HolderUserID: "holder_user_id",
  TypeID: "type_id",
  IssuerOrganizationID: "issuer_organization_id",
  Number: "number",
  IssuedAt: "issued_at",
  ExpiresAt: "expires_at",
  CompetencyIDs: "competency_ids",
  SubmitterUserID: "submitter_user_id",
  Name: "name",
  File: "file",
  Meta: "meta_entries",
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

export function useIssueCredentials<T extends FieldValues>(form?: UseFormReturn<T>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: CredentialIssueRowInput[]) => {
      const formData = new FormData();
      rows.forEach((row, i) => {
        formData.append(`credentials[${i}][holder_user_id]`, row.holder_user_id);
        formData.append(`credentials[${i}][name]`, row.name);
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
      await api.post("/credentials/batch/issue", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
      notify.success("credential.issue.success");
    },
    onError: (error) => {
      if (isApiError(error) && error.fieldErrors && form) {
        setServerErrors(form, normalizeBatchErrorPaths(error.fieldErrors));
        void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
        notify.error("validation.form_errors");
      } else if (isApiError(error)) {
        notify.error(error.messageKey);
      } else {
        notify.error("credential.issue.submitError");
      }
    },
  });
}
