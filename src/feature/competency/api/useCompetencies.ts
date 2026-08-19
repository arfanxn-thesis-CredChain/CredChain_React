import { useReferenceList } from "@shared/api/useReferenceData";
import { competencyResource } from "./keys";

export function useCompetencies() {
  return useReferenceList(competencyResource);
}
