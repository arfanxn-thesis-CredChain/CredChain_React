import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import type { PaginatedResponse, ReferenceResource, ReferenceRow } from "@shared/types/api";

/**
 * Reference-data lookups (credential types, issuer organizations, competencies)
 * and the create-by-name (upsert) mutation.
 *
 * Lives in shared so `SearchableCreateSelect` can consume it without breaking
 * the module boundary rule (feature → shared only). The credential feature
 * re-exports these as `src/feature/credential/api/useReferenceData.ts`.
 */

export const referenceKeys = {
  list: (resource: ReferenceResource) => ["reference", resource] as const,
};

const RESOURCE_PATH: Record<ReferenceResource, string> = {
  "credential-types": "/credential-types",
  // Backend group is `/issuer-organizations` (see CredChain_Golang router.go).
  "credential-issuer-organizations": "/issuer-organizations",
  competencies: "/competencies",
};

export function useReferenceList(resource: ReferenceResource) {
  return useQuery({
    queryKey: referenceKeys.list(resource),
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<ReferenceRow>>(RESOURCE_PATH[resource], {
        params: { limit: 100 },
      });
      return response.data;
    },
  });
}

export function useCredentialTypes() {
  return useReferenceList("credential-types");
}

export function useIssuerOrganizations() {
  return useReferenceList("credential-issuer-organizations");
}

export function useCompetencies() {
  return useReferenceList("competencies");
}

export function useUpsertReference(resource: ReferenceResource) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post<ReferenceRow>(RESOURCE_PATH[resource], { name });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referenceKeys.list(resource) });
    },
    onError: (error) => {
      if (isApiError(error)) {
        notify.error(error.messageKey);
      } else {
        notify.error("cred.submit.createError");
      }
    },
  });
}
