import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import type { CredentialDTO } from "@shared/types/api";
import { credentialKeys } from "./keys";

export function useCredential(id: string, includes?: string[]) {
  const user = useStore((s) => s.user);
  const isHolder = user?.role === Role.HOLDER;

  return useQuery({
    queryKey: [...credentialKeys.detail(id, includes), user?.id, user?.role],
    queryFn: async ({ signal }) => {
      const params: Record<string, unknown> = {};
      if (includes?.length) params.includes = includes;
      const endpoint = isHolder ? `/users/self/credentials/${id}` : `/credentials/${id}`;
      const response = await api.get<CredentialDTO>(endpoint, { params, signal });
      return response.data;
    },
    enabled: !!id,
  });
}
