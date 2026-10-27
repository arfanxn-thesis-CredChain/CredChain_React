import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { useStore } from "@app/store";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import type { UserSelfEmailInput } from "../schemas/user";
import { userKeys } from "./keys";

export function useUpdateSelfEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UserSelfEmailInput) => {
      const response = await api.put<{ email: string }>("/users/self/email", data);
      return response.data;
    },
    onSuccess: ({ email }) => {
      const { user, setUser } = useStore.getState();
      if (user) setUser({ ...user, email });
      void queryClient.invalidateQueries({ queryKey: userKeys.self() });
      notify.success("user.email_update.success");
    },
    onError: (error) => {
      if (isApiError(error)) notify.error(error.messageKey);
    },
  });
}
