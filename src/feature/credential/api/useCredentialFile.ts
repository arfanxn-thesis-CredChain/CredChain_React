import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { credentialKeys } from "./keys";
import { useStore } from "@app/store";

export function useCredentialFile(id: string, enabled: boolean) {
  const user = useStore((s) => s.user);
  return useQuery({
    queryKey: [...credentialKeys.file(id), user?.id, user?.role],
    queryFn: async ({ signal }) => {
      const response = await api.get<Blob>(`/credentials/${id}/file`, {
        responseType: "blob",
        signal,
      });
      return response.data;
    },
    enabled: !!id && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
