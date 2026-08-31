import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import type { CredentialMetadataSuggestionsDTO } from "@shared/types/api";
import { credentialKeys } from "./keys";

/**
 * Fuzzy-matched taxonomy candidates for a credential's unresolved staged
 * names. Issuer+ route — pass enabled=false for holders and for credentials
 * with nothing staged, so no 403 is fired at a page that cannot use it.
 */
export function useMetadataSuggestions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: credentialKeys.metadataSuggestions(id),
    enabled: !!id && enabled,
    queryFn: async () => {
      const response = await api.get<CredentialMetadataSuggestionsDTO>(
        `/credentials/${id}/metadata/suggestions`,
      );
      return response.data;
    },
  });
}
