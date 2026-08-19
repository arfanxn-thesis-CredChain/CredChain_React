import { useIssuerOrganizations } from "../api/useReferenceData";
import { CredentialFilterMenu } from "./CredentialFilterMenu";

interface CredentialOrganizationFilterMenuProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function CredentialOrganizationFilterMenu({
  value,
  onChange,
}: CredentialOrganizationFilterMenuProps) {
  const { data } = useIssuerOrganizations();
  return (
    <CredentialFilterMenu
      labelKey="cred.filter.organization"
      allLabelKey="cred.filter.organizationAll"
      value={value}
      onChange={onChange}
      options={data?.items ?? []}
    />
  );
}
