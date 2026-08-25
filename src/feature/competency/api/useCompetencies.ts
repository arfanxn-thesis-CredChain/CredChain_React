import { useReferencePage, type ReferenceQuery } from "@shared/api/useReferenceData";
import { competencyResource } from "./keys";

export function useCompetencies(query: ReferenceQuery = {}) {
  return useReferencePage(competencyResource, query);
}
