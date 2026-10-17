import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { credentialKeys } from "./keys";

export function useReExtractCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await api.post("/credentials/batch/reextract", { ids });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
      notify.success("credential.reextract.success");
    },
    onError: (error) => {
      if (isApiError(error)) {
        notify.error(error.messageKey);
        if (error.status === 409 || error.status === 422 || error.status === 404) {
          void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
        }
      }
    },
  });
}
