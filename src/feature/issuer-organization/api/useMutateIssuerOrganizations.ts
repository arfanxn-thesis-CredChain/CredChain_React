import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { isApiError } from "@shared/api/envelope";
import { notify } from "@shared/lib/notify";
import type { ReferenceRow } from "@shared/types/api";
import { issuerOrganizationKeys, issuerOrganizationResource } from "./keys";

const ADMIN_FALLBACK_KEY = "admin.issuerOrg.actionError";

function handleError(error: unknown) {
  if (isApiError(error)) {
    notify.error(error.messageKey);
  } else {
    notify.error(ADMIN_FALLBACK_KEY);
  }
}

export function useStoreIssuerOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post<ReferenceRow>("/issuer-organizations", { name });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: issuerOrganizationKeys.list(issuerOrganizationResource),
      });
      notify.success("success_issuer_organization_store");
    },
    onError: handleError,
  });
}

export function useUpdateIssuerOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.put<ReferenceRow>(`/issuer-organizations/${id}`, { name });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: issuerOrganizationKeys.list(issuerOrganizationResource),
      });
      notify.success("success_issuer_organization_update");
    },
    onError: handleError,
  });
}

export function useDestroyIssuerOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<ReferenceRow>(`/issuer-organizations/${id}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: issuerOrganizationKeys.list(issuerOrganizationResource),
      });
      notify.success("success_issuer_organization_destroy");
    },
    onError: handleError,
  });
}
