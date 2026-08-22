import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterTrigger } from "@shared/components/FilterTrigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

export type StatusFilter = "all" | "deleted_at_" | "deleted_at!_";

interface StatusFilterMenuProps {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}

export function StatusFilterMenu({ value, onChange }: StatusFilterMenuProps) {
  const { t } = useTranslation();

  const options: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("user.filter.all") },
    { key: "deleted_at_", label: t("user.filter.active") },
    { key: "deleted_at!_", label: t("user.filter.trashed") },
  ];

  const activeOption = options.find((opt) => opt.key === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger active={value !== "all"}>
          {activeOption
            ? `${t("user.filter.status")}: ${activeOption.label}`
            : t("user.filter.status")}
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
