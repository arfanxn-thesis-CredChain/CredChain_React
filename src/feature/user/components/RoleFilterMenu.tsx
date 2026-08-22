import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Role } from "@shared/auth/role";
import { FilterTrigger } from "@shared/components/FilterTrigger";
import type { RoleFilter } from "../hooks/useUserListParams";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

interface RoleFilterMenuProps {
  value: RoleFilter;
  onChange: (value: RoleFilter) => void;
}

export function RoleFilterMenu({ value, onChange }: RoleFilterMenuProps) {
  const { t } = useTranslation();

  const options: { key: RoleFilter; label: string }[] = [
    { key: "all", label: t("user.role.filter.all") },
    { key: Role.SUPER_ADMIN, label: t("user.role.filter.superAdmin") },
    { key: Role.ADMIN, label: t("user.role.filter.admin") },
    { key: Role.ISSUER, label: t("user.role.filter.issuer") },
    { key: Role.HOLDER, label: t("user.role.filter.holder") },
  ];

  const activeOption = options.find((opt) => opt.key === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger active={value !== "all"}>
          {activeOption
            ? `${t("user.role.filter.label")}: ${activeOption.label}`
            : t("user.role.filter.label")}
        </FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onChange(opt.key)}
              className="flex cursor-pointer items-center justify-between"
            >
              <span className={active ? "font-bold" : ""}>{opt.label}</span>
              {active && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
