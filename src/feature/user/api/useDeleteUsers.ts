import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { userKeys } from "./keys";

export function useDeleteUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await api.delete("/users/batch", { data: { ids } });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify.success("user.delete.success");
    },
    onError: (error) => {
      if (isApiError(error)) notify.error(error.messageKey);
    },
  });
}
