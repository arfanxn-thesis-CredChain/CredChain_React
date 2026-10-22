import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { setServerErrors } from "@shared/lib/forms";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import type { UserBatchStoreInput } from "../schemas/user";
import { userKeys } from "./keys";

export function useCreateUsers<T extends FieldValues>(form?: UseFormReturn<T>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UserBatchStoreInput) => {
      const response = await api.post("/users/batch", data);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify.success("user.store.success");
    },
    onError: (error) => {
      if (isApiError(error) && error.fieldErrors && form) {
        setServerErrors(form, error.fieldErrors);
        notify.error("validation.form_errors");
      } else if (isApiError(error)) {
        notify.error(error.messageKey);
      }
    },
  });
}
