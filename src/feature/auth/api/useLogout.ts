import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { logoutSession } from "@shared/api/client";
import { isApiError } from "@shared/api/envelope";
import { useStore } from "@app/store";
import { notify } from "@shared/lib/notify";

export function useLogout() {
  const clearUser = useStore((s) => s.clearUser);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logoutSession,
    onSettled: () => {
      clearUser();
      queryClient.clear();
      navigate("/", { replace: true });
    },
    onSuccess: () => notify.info("auth.logout.success"),
    onError: (error) =>
      notify.error(isApiError(error) ? error.messageKey : "system.internal_error"),
  });
}
