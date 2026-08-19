import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { isApiError } from "@shared/api/envelope";
import { notify } from "@shared/lib/notify";
import type { HolderUnitDTO } from "@shared/types/api";
import { userUnitKeys } from "./keys";

const ADMIN_FALLBACK_KEY = "admin.userUnit.actionError";

function handleError(error: unknown) {
  if (isApiError(error)) {
    notify.error(error.messageKey);
  } else {
    notify.error(ADMIN_FALLBACK_KEY);
  }
}

export function useStoreUserUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, parent_id }: { name: string; parent_id: string | null }) => {
      const response = await api.post<HolderUnitDTO>("/user-units", { name, parent_id });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userUnitKeys.list() });
      notify.success("success_user_unit_store");
    },
    onError: handleError,
  });
}

export function useUpdateUserUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      parent_id,
    }: {
      id: string;
      name?: string;
      parent_id?: string | null;
    }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (parent_id !== undefined) body.parent_id = parent_id;
      const response = await api.put<HolderUnitDTO>(`/user-units/${id}`, body);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userUnitKeys.list() });
      notify.success("success_user_unit_update");
    },
    onError: handleError,
  });
}

export function useDestroyUserUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<HolderUnitDTO>(`/user-units/${id}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userUnitKeys.list() });
      notify.success("success_user_unit_destroy");
    },
    onError: handleError,
  });
}
