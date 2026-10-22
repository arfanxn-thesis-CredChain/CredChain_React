import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import type { UserBatchUpdateRoleInput } from "../schemas/user";
import { userKeys } from "./keys";

export function useUpdateUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UserBatchUpdateRoleInput) => {
      const response = await api.put("/users/batch/role", data);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify.success("user.role_update.success");
    },
    onError: (error) => {
      if (isApiError(error)) notify.error(error.messageKey);
    },
  });
}
