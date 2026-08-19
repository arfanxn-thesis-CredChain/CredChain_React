import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { isApiError } from "@shared/api/envelope";
import { notify } from "@shared/lib/notify";
import type { ReferenceRow } from "@shared/types/api";
import { competencyKeys, competencyResource } from "./keys";

const ADMIN_FALLBACK_KEY = "admin.competency.actionError";

function handleError(error: unknown) {
  if (isApiError(error)) {
    notify.error(error.messageKey);
  } else {
    notify.error(ADMIN_FALLBACK_KEY);
  }
}

export function useStoreCompetency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post<ReferenceRow>("/competencies", { name });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: competencyKeys.list(competencyResource) });
      notify.success("success_competency_store");
    },
    onError: handleError,
  });
}

export function useUpdateCompetency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.put<ReferenceRow>(`/competencies/${id}`, { name });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: competencyKeys.list(competencyResource) });
      notify.success("success_competency_update");
    },
    onError: handleError,
  });
}

export function useDestroyCompetency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<ReferenceRow>(`/competencies/${id}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: competencyKeys.list(competencyResource) });
      notify.success("success_competency_destroy");
    },
    onError: handleError,
  });
}
