import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterTrigger } from "./FilterTrigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { CREDENTIAL_SORT_OPTIONS } from "@shared/lib/credentialSort";

interface CredentialSortMenuProps {
  value: string;
  onChange: (sortString: string) => void;
}

export function CredentialSortMenu({ value, onChange }: CredentialSortMenuProps) {
  const { t } = useTranslation();

  const activeOption =
    CREDENTIAL_SORT_OPTIONS.find((opt) => opt.value === value) ?? CREDENTIAL_SORT_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger>{`${t("cred.sort.label")}: ${t(activeOption.labelKey)}`}</FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {CREDENTIAL_SORT_OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onChange(opt.value)}
              className="flex cursor-pointer items-center justify-between"
            >
              <span className={active ? "font-bold" : ""}>{t(opt.labelKey)}</span>
              {active && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
