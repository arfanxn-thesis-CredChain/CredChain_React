import { useCredentialTypes } from "../api/useReferenceData";
import { CredentialFilterMenu } from "./CredentialFilterMenu";

interface CredentialTypeFilterMenuProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function CredentialTypeFilterMenu({ value, onChange }: CredentialTypeFilterMenuProps) {
  const { data } = useCredentialTypes();
  return (
    <CredentialFilterMenu
      labelKey="cred.filter.type"
      allLabelKey="cred.filter.typeAll"
      value={value}
      onChange={onChange}
      options={data?.items ?? []}
    />
  );
}
