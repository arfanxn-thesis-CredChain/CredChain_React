import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterTrigger } from "./FilterTrigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import type { CredentialStatusFilter } from "./CredentialStatusFilterMenu";

interface CredentialSortMenuProps {
  value: string;
  onChange: (sortString: string) => void;
  statusFilter: CredentialStatusFilter;
}

interface SortOption {
  key: string;
  labelKey: string;
  getSortString: (status: CredentialStatusFilter) => string;
}

const OPTIONS: SortOption[] = [
  {
    key: "newest",
    labelKey: "cred.sort.newest",
    getSortString: (s) =>
      s === "revoked" ? "-revoked_at" : s === "expired" ? "-expires_at" : "-issued_at",
  },
  {
    key: "oldest",
    labelKey: "cred.sort.oldest",
    getSortString: (s) =>
      s === "revoked" ? "revoked_at" : s === "expired" ? "expires_at" : "issued_at",
  },
  {
    key: "nameAZ",
    labelKey: "cred.sort.nameAZ",
    getSortString: () => "name",
  },
  {
    key: "nameZA",
    labelKey: "cred.sort.nameZA",
    getSortString: () => "-name",
  },
];

export function CredentialSortMenu({ value, onChange, statusFilter }: CredentialSortMenuProps) {
  const { t } = useTranslation();

  const activeOption = OPTIONS.find((opt) => opt.getSortString(statusFilter) === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger>
          {activeOption
            ? `${t("cred.sort.label")}: ${t(activeOption.labelKey)}`
            : t("cred.sort.label")}
        </FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {OPTIONS.map((opt) => {
          const sortString = opt.getSortString(statusFilter);
          const active = sortString === value;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onChange(sortString)}
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
