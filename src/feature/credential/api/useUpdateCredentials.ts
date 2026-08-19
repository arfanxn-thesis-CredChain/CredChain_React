import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { credentialKeys } from "./keys";

export interface CredentialUpdateItem {
  id: string;
  name?: string;
  number?: string;
  type_id?: string;
  issuer_organization_id?: string;
  issued_at?: string;
  expires_at?: string;
  meta?: Record<string, unknown>;
}

export function useUpdateCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: CredentialUpdateItem[]) => {
      const response = await api.put("/credentials/batch", { credentials: items });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
      notify.success("success_credential_update");
    },
    onError: (error) => {
      if (isApiError(error)) notify.error(error.messageKey);
      else notify.error("cred.detail.updateFailed");
    },
  });
}
