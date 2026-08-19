import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

export interface CredentialFilterOption {
  id: string;
  name: string;
}

interface CredentialFilterMenuProps {
  labelKey: string;
  allLabelKey: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: CredentialFilterOption[];
}

export function CredentialFilterMenu({
  labelKey,
  allLabelKey,
  value,
  onChange,
  options,
}: CredentialFilterMenuProps) {
  const { t } = useTranslation();

  const selected = options.find((opt) => opt.id === value);
  const triggerLabel = selected ? selected.name : t(allLabelKey);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {`${t(labelKey)}: ${triggerLabel}`}
          <ChevronDown className="ml-1 h-3 w-3 text-gray-400" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => onChange(null)}
          className="flex cursor-pointer items-center justify-between"
        >
          <span className={value === null ? "font-bold" : ""}>{t(allLabelKey)}</span>
          {value === null && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
        </DropdownMenuItem>
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className="flex cursor-pointer items-center justify-between"
            >
              <span className={active ? "font-bold" : ""}>{opt.name}</span>
              {active && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
