import { useCompetencies } from "../api/useReferenceData";
import { CredentialFilterMenu } from "./CredentialFilterMenu";

interface CredentialCompetencyFilterMenuProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function CredentialCompetencyFilterMenu({
  value,
  onChange,
}: CredentialCompetencyFilterMenuProps) {
  const { data } = useCompetencies();
  return (
    <CredentialFilterMenu
      labelKey="cred.filter.competency"
      allLabelKey="cred.filter.competencyAll"
      value={value}
      onChange={onChange}
      options={data ?? []}
    />
  );
}
