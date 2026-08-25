import { useReferencePage, type ReferenceQuery } from "@shared/api/useReferenceData";

export {
  referenceKeys,
  useReferenceByIds,
  useReferencePage,
  useUpsertReference,
  type ReferenceQuery,
} from "@shared/api/useReferenceData";

// Defined here rather than re-exported from the credential-type / competency /
// issuer-organization features: feature → feature imports are forbidden
// (AGENTS.md module boundaries). These are one-line wrappers over the shared
// hook, so the duplication is a name, not logic.

export function useCredentialTypes(query: ReferenceQuery = {}) {
  return useReferencePage("credential-types", query);
}

export function useIssuerOrganizations(query: ReferenceQuery = {}) {
  return useReferencePage("credential-issuer-organizations", query);
}

export function useCompetencies(query: ReferenceQuery = {}) {
  return useReferencePage("competencies", query);
}
