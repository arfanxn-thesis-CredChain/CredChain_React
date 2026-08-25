import { useReferencePage, type ReferenceQuery } from "@shared/api/useReferenceData";
import { issuerOrganizationResource } from "./keys";

export function useIssuerOrganizations(query: ReferenceQuery = {}) {
  return useReferencePage(issuerOrganizationResource, query);
}
