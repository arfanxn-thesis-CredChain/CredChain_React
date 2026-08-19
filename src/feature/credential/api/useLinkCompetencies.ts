import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { credentialKeys } from "./keys";

export interface LinkCompetenciesInput {
  credentialId: string;
  competencyIds: string[];
}

export function useLinkCompetencies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ credentialId, competencyIds }: LinkCompetenciesInput) => {
      const response = await api.put(`/credentials/${credentialId}/competencies`, {
        competency_ids: competencyIds,
      });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.all() });
      notify.success("success_credential_competency_link");
    },
    onError: (error) => {
      if (isApiError(error)) notify.error(error.messageKey);
      else notify.error("cred.competency.linkFailed");
    },
  });
}
