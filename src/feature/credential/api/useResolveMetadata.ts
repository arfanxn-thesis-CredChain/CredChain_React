import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { referenceKeys } from "@shared/api/useReferenceData";
import type { CredentialDTO } from "@shared/types/api";
import { credentialKeys } from "./keys";

export interface ResolveMetadataInput {
  credentialId: string;
  typeId?: string;
  createTypeName?: string;
  organizationId?: string;
  createOrganizationName?: string;
  competencyIds?: string[];
  createCompetencyNames?: string[];
}

/**
 * Resolves a pending credential's staged free-text metadata names — linking
 * existing taxonomy rows or creating new ones. Issuer+ only. Approval is
 * blocked server-side until every staged name is resolved.
 */
export function useResolveMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ credentialId, ...input }: ResolveMetadataInput) => {
      // Omit undefined keys: the server treats an absent field as "leave this
      // kind alone" and only maps present snake_case fields onto the request DTO.
      const body: Record<string, unknown> = {};
      if (input.typeId) body.type_id = input.typeId;
      if (input.createTypeName) body.create_type_name = input.createTypeName;
      if (input.organizationId) body.issuer_organization_id = input.organizationId;
      if (input.createOrganizationName) body.create_organization_name = input.createOrganizationName;
      if (input.competencyIds?.length) body.competency_ids = input.competencyIds;
      if (input.createCompetencyNames?.length) body.create_competency_names = input.createCompetencyNames;

      const response = await api.put<CredentialDTO>(`/credentials/${credentialId}/metadata`, body);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
      // Creating a taxonomy row here makes every cached reference page stale.
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all("competencies") });
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all("credential-types") });
      void queryClient.invalidateQueries({
        queryKey: referenceKeys.all("credential-issuer-organizations"),
      });
      notify.success("success_credential_metadata_resolve");
    },
    onError: (error) => {
      if (isApiError(error)) notify.error(error.messageKey);
      else notify.error("cred.metadata.resolveFailed");
    },
  });
}
