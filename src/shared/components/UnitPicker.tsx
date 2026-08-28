import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@shared/lib/cn";
import { flattenUnitTree } from "@shared/lib/units";
import { useUserUnits } from "@shared/api/useUserUnits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

interface UnitPickerProps {
  /** Any falsy value means "not set", so callers need no sentinel. */
  value: string | null | undefined;
  onChange: (unitId: string | undefined) => void;
  /** Used as the trigger's accessible name. */
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

/** Show the in-dropdown search box only once the tree is long enough to warrant it. */
const SEARCH_THRESHOLD = 8;

/**
 * Hierarchical, searchable unit selector shaped like a form field.
 *
 * A DropdownMenu rather than a Select because the tree needs a search input
 * inside the panel, which Radix Select's typeahead-owned content cannot host.
 * The panel is width-matched to the trigger via the Radix-provided custom
 * property, so it tracks the surrounding grid cell at every breakpoint.
 */
export function UnitPicker({
  value,
  onChange,
  label,
  placeholder,
  error,
  disabled,
  className,
}: UnitPickerProps) {
  const { t } = useTranslation();
  const { data: units } = useUserUnits();
  const [query, setQuery] = useState("");

  const nodes = flattenUnitTree(units ?? []);
  const selected = value ? nodes.find((node) => node.id === value) : undefined;

  const showSearch = nodes.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const filtered = searching ? nodes.filter((node) => node.name.toLowerCase().includes(q)) : nodes;

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          className={cn(
            "flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3",
            "bg-gray-50 text-left text-sm text-navy shadow-sm",
            "focus:border-transparent focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold",
            "transition-all",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error && "border-error",
            className,
          )}
        >
          <span className={cn("line-clamp-1", !selected && "text-gray-400")}>
            {selected ? selected.name : (placeholder ?? t("common.notSet"))}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-80 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto"
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
          onClick={() => onChange(undefined)}
          className="flex cursor-pointer items-center justify-between"
        >
          <span className={!value ? "font-bold" : ""}>{t("common.notSet")}</span>
          {!value && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
        </DropdownMenuItem>
        {filtered.map((node) => {
          const selectedOpt = node.id === value;
          // An inactive unit cannot be assigned (rule 7) — except the one
          // already selected, which must stay clickable so an existing
          // assignment can still be seen and changed.
          const blocked = !node.active && !selectedOpt;
          return (
            <DropdownMenuItem
              key={node.id}
              disabled={blocked}
              onClick={() => onChange(node.id)}
              className={cn(
                "flex cursor-pointer items-center justify-between",
                blocked && "cursor-not-allowed opacity-50",
              )}
              style={searching ? undefined : { paddingLeft: `${0.5 + node.depth * 0.85}rem` }}
            >
              <span className={selectedOpt ? "font-bold" : ""}>{node.name}</span>
              {!node.active && (
                <span className="shrink-0 text-xs text-gray-400">{t("cred.submit.inactive")}</span>
              )}
              {selectedOpt && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
