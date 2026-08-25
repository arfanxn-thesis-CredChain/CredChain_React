import { useReferencePage, type ReferenceQuery } from "@shared/api/useReferenceData";
import { credentialTypeResource } from "./keys";

export function useCredentialTypes(query: ReferenceQuery = {}) {
  return useReferencePage(credentialTypeResource, query);
}
