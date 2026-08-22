import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterTrigger } from "@shared/components/FilterTrigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

export interface CredentialFilterOption {
  id: string;
  name: string;
  /** Optional tree depth; when set, indents the row to show unit hierarchy. */
  depth?: number;
}

interface CredentialFilterMenuProps {
  labelKey: string;
  allLabelKey: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: CredentialFilterOption[];
}

/** Show the in-dropdown search box only once the list is long enough to warrant it. */
const SEARCH_THRESHOLD = 8;

export function CredentialFilterMenu({
  labelKey,
  allLabelKey,
  value,
  onChange,
  options,
}: CredentialFilterMenuProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const selected = options.find((opt) => opt.id === value);
  const triggerLabel = selected ? selected.name : t(allLabelKey);

  const showSearch = options.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((opt) => opt.name.toLowerCase().includes(q)) : options;

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger asChild>
        <FilterTrigger active={value !== null}>{`${t(labelKey)}: ${triggerLabel}`}</FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-56 overflow-y-auto"
      >
        {showSearch && (
          <div className="px-1 pb-1">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t("filter.searchPlaceholder")}
              aria-label={t("filter.searchPlaceholder")}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-navy outline-none focus:border-gold"
            />
          </div>
        )}
        <DropdownMenuItem
          onClick={() => onChange(null)}
          className="flex cursor-pointer items-center justify-between"
        >
          <span className={value === null ? "font-bold" : ""}>{t(allLabelKey)}</span>
          {value === null && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
        </DropdownMenuItem>
        {filtered.map((opt) => {
          const active = opt.id === value;
          return (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className="flex cursor-pointer items-center justify-between"
              style={opt.depth ? { paddingLeft: `${0.5 + opt.depth * 0.85}rem` } : undefined}
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
