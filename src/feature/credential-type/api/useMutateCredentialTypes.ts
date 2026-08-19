import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { isApiError } from "@shared/api/envelope";
import { notify } from "@shared/lib/notify";
import type { ReferenceRow } from "@shared/types/api";
import { credentialTypeKeys, credentialTypeResource } from "./keys";

const ADMIN_FALLBACK_KEY = "admin.credType.actionError";

function handleError(error: unknown) {
  if (isApiError(error)) {
    notify.error(error.messageKey);
  } else {
    notify.error(ADMIN_FALLBACK_KEY);
  }
}

export function useStoreCredentialType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post<ReferenceRow>("/credential-types", { name });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: credentialTypeKeys.list(credentialTypeResource),
      });
      notify.success("success_credential_type_store");
    },
    onError: handleError,
  });
}

export function useUpdateCredentialType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, active }: { id: string; name: string; active: boolean }) => {
      const response = await api.put<ReferenceRow>(`/credential-types/${id}`, { name, active });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: credentialTypeKeys.list(credentialTypeResource),
      });
      notify.success("success_credential_type_update");
    },
    onError: handleError,
  });
}

export function useDestroyCredentialType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<ReferenceRow>(`/credential-types/${id}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: credentialTypeKeys.list(credentialTypeResource),
      });
      notify.success("success_credential_type_destroy");
    },
    onError: handleError,
  });
}
