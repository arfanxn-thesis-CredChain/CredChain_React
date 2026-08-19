import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { credentialKeys } from "./keys";

export function useApproveCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await api.post("/credentials/batch/approve", { ids });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
      notify.success("cred.approve.success");
    },
    onError: (error) => {
      if (isApiError(error)) notify.error(error.messageKey);
      else notify.error("cred.approve.failed");
    },
  });
}
