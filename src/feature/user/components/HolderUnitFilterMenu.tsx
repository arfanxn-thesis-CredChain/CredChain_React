import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { flattenUnitTree } from "@shared/lib/units";
import { FilterTrigger } from "@shared/components/FilterTrigger";
import { useUserUnits } from "../api/useUserUnits";
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

/** Show the in-dropdown search box only once the tree is long enough to warrant it. */
const SEARCH_THRESHOLD = 8;

export function HolderUnitFilterMenu({ value, onChange }: HolderUnitFilterMenuProps) {
  const { t } = useTranslation();
  const { data: units } = useUserUnits();
  const [query, setQuery] = useState("");

  const nodes = flattenUnitTree(units ?? []);
  const selected = nodes.find((node) => node.id === value);

  const showSearch = nodes.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const filtered = searching ? nodes.filter((node) => node.name.toLowerCase().includes(q)) : nodes;

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger asChild>
        <FilterTrigger active={value !== ""}>
          {`${t("user.filter.unit")}: ${selected ? selected.name : t("user.filter.all")}`}
        </FilterTrigger>
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
          onClick={() => onChange("")}
          className="flex cursor-pointer items-center justify-between"
        >
          <span className={value === "" ? "font-bold" : ""}>{t("user.filter.all")}</span>
          {value === "" && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
        </DropdownMenuItem>
        {filtered.map((node) => {
          const active = node.id === value;
          return (
            <DropdownMenuItem
              key={node.id}
              onClick={() => onChange(node.id)}
              className="flex cursor-pointer items-center justify-between"
              style={searching ? undefined : { paddingLeft: `${0.5 + node.depth * 0.85}rem` }}
            >
              <span className={active ? "font-bold" : ""}>{node.name}</span>
              {active && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
