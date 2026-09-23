import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { credentialKeys } from "./keys";

import type { CredentialBatchRevokeInput } from "../schemas/credential";

export function useRevokeCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CredentialBatchRevokeInput) => {
      const response = await api.post("/credentials/batch/revoke", payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
      notify.success("credential.revoke.success");
    },
    onError: (error) => {
      if (isApiError(error)) notify.error(error.messageKey);
    },
  });
}
