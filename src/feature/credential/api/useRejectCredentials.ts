import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { credentialKeys } from "./keys";

export interface CredentialRejectionInput {
  id: string;
  reason: string;
}

export function useRejectCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rejections: CredentialRejectionInput[]) => {
      const response = await api.post("/credentials/batch/reject", { rejections });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
      notify.success("cred.reject.success");
    },
    onError: (error) => {
      if (isApiError(error)) notify.error(error.messageKey);
      else notify.error("cred.reject.failed");
    },
  });
}
