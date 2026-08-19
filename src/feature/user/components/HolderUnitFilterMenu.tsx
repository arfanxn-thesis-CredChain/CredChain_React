import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUserUnits } from "../api/useUserUnits";
import { Button } from "@ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

interface HolderUnitFilterMenuProps {
  value: string;
  onChange: (value: string) => void;
}

export function HolderUnitFilterMenu({ value, onChange }: HolderUnitFilterMenuProps) {
  const { t } = useTranslation();
  const { data: units } = useUserUnits();

  const selected = units?.find((unit) => unit.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {`${t("user.filter.unit")}: ${selected ? selected.name : t("user.filter.all")}`}
          <ChevronDown className="ml-1 h-3 w-3 text-gray-400" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => onChange("")}
          className="flex cursor-pointer items-center justify-between"
        >
          <span className={value === "" ? "font-bold" : ""}>{t("user.filter.all")}</span>
          {value === "" && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
        </DropdownMenuItem>
        {(units ?? []).map((unit) => {
          const active = unit.id === value;
          return (
            <DropdownMenuItem
              key={unit.id}
              onClick={() => onChange(unit.id)}
              className="flex cursor-pointer items-center justify-between"
            >
              <span className={active ? "font-bold" : ""}>{unit.name}</span>
              {active && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
