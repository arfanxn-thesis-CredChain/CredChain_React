import { flattenUnitTree } from "@shared/lib/units";
import { useUserUnits } from "../api/useUserUnits";
import { CredentialFilterMenu } from "./CredentialFilterMenu";

interface HolderUnitFilterMenuProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function HolderUnitFilterMenu({ value, onChange }: HolderUnitFilterMenuProps) {
  const { data } = useUserUnits();
  return (
    <CredentialFilterMenu
      labelKey="cred.filter.unit"
      allLabelKey="cred.filter.unitAll"
      value={value}
      onChange={onChange}
      options={flattenUnitTree(data ?? [])}
    />
  );
}
