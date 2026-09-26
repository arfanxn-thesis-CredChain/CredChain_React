import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

export type CredentialStatusFilter = "all" | "active" | "expired" | "revoked" | "pending" | "failed";

interface CredentialStatusFilterMenuProps {
  value: CredentialStatusFilter;
  onChange: (value: CredentialStatusFilter) => void;
}

const OPTIONS: { key: CredentialStatusFilter; labelKey: string }[] = [
  { key: "all", labelKey: "cred.filter.all" },
  { key: "active", labelKey: "cred.filter.active" },
  { key: "expired", labelKey: "cred.filter.expired" },
  { key: "revoked", labelKey: "cred.filter.revoked" },
  { key: "pending", labelKey: "cred.filter.pending" },
  { key: "failed", labelKey: "cred.filter.failed" },
];

export function CredentialStatusFilterMenu({ value, onChange }: CredentialStatusFilterMenuProps) {
  const { t } = useTranslation();

  const activeOption = OPTIONS.find((opt) => opt.key === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {activeOption
            ? `${t("cred.filter.status")}: ${t(activeOption.labelKey)}`
            : t("cred.filter.status")}
          <ChevronDown className="ml-1 h-3 w-3 text-gray-400" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {OPTIONS.map((opt) => {
          const active = opt.key === value;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onChange(opt.key)}
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
