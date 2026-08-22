import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterTrigger } from "@shared/components/FilterTrigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

interface SortMenuProps {
  value: string;
  onChange: (sortString: string) => void;
}

export function SortMenu({ value, onChange }: SortMenuProps) {
  const { t } = useTranslation();

  const options: { key: string; sortString: string; label: string }[] = [
    { key: "newest", sortString: "-updated_at", label: t("user.sort.option.newest") },
    { key: "oldest", sortString: "updated_at", label: t("user.sort.option.oldest") },
    { key: "nameAZ", sortString: "name", label: t("user.sort.option.nameAZ") },
    { key: "nameZA", sortString: "-name", label: t("user.sort.option.nameZA") },
    { key: "role", sortString: "role", label: t("user.sort.option.role") },
  ];

  const activeOption = options.find((opt) => opt.sortString === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger>
          {activeOption ? `${t("user.sort.label")}: ${activeOption.label}` : t("user.sort.label")}
        </FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {options.map((opt) => {
          const active = opt.sortString === value;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onChange(opt.sortString)}
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
