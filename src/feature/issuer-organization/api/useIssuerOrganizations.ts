import { useReferenceList } from "@shared/api/useReferenceData";
import { issuerOrganizationResource } from "./keys";

export function useIssuerOrganizations() {
  return useReferenceList(issuerOrganizationResource);
}
