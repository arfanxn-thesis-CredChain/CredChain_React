import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
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
  /**
   * Supply these together to search on the server. `options` is then already
   * filtered, and the paginated tail is reachable through onLoadMore. Omit them
   * for a list that is fully loaded up front (the unit tree) — it filters here.
   */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isFetchingNextPage?: boolean;
  /** Name for the current selection when it lives past the loaded page. */
  selectedName?: string;
}

export function CredentialFilterMenu({
  labelKey,
  allLabelKey,
  value,
  onChange,
  options,
  searchValue,
  onSearchChange,
  hasMore,
  onLoadMore,
  isFetchingNextPage,
  selectedName,
}: CredentialFilterMenuProps) {
  const { t } = useTranslation();
  const [localQuery, setLocalQuery] = useState("");

  const serverSide = onSearchChange !== undefined;
  const query = serverSide ? (searchValue ?? "") : localQuery;
  const setQuery = serverSide ? onSearchChange : setLocalQuery;

  const selected = options.find((opt) => opt.id === value);
  const triggerLabel = selected?.name ?? selectedName ?? t(allLabelKey);

  // Server-side results arrive already filtered; re-filtering here would drop
  // rows the server matched on something other than a substring.
  const q = localQuery.trim().toLowerCase();
  const filtered =
    serverSide || !q ? options : options.filter((opt) => opt.name.toLowerCase().includes(q));

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger asChild>
        <FilterTrigger active={value !== null}>{`${t(labelKey)}: ${triggerLabel}`}</FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-56 overflow-y-auto"
      >
        {/* stopPropagation or Radix's typeahead swallows the keystrokes. */}
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
        {hasMore && onLoadMore && (
          <DropdownMenuItem
            // Radix closes the menu on select; loading the next page must not.
            onSelect={(e) => e.preventDefault()}
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="flex cursor-pointer items-center justify-center gap-2 border-t border-gray-100 font-medium text-gray-500"
          >
            {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("common.loadMore")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
