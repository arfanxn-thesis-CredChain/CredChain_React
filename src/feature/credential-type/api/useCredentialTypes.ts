import { useReferenceList } from "@shared/api/useReferenceData";
import { credentialTypeResource } from "./keys";

export function useCredentialTypes() {
  return useReferenceList(credentialTypeResource);
}
