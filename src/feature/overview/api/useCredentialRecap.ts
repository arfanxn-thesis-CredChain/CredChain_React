import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import type { CredentialRecap } from "@shared/types/api";
import { overviewKeys } from "./keys";

export function useCredentialRecap() {
  return useQuery({
    queryKey: overviewKeys.recap(),
    queryFn: async () => (await api.get<CredentialRecap>("/overview/credential-recap")).data,
    staleTime: 0,
  });
}
