import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterTrigger } from "@shared/components/FilterTrigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { YEAR_FLOOR } from "../hooks/useUserListParams";

interface JoinedYearFilterMenuProps {
  from: string;
  to: string;
  /** Both bounds at once, so one pick is a single URL write. */
  onChange: (next: { from: string; to: string }) => void;
}

function YearColumn({
  heading,
  years,
  value,
  onPick,
}: {
  heading: string;
  years: number[];
  value: string;
  onPick: (year: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="px-2 pb-1 text-xs font-semibold text-gray-500">{heading}</p>
      <div className="max-h-56 overflow-y-auto">
        {years.map((year) => {
          const active = String(year) === value;
          return (
            <DropdownMenuItem
              key={year}
              // Keep the panel open so the second bound can be picked in one visit.
              onSelect={(e) => e.preventDefault()}
              onClick={() => onPick(active ? "" : String(year))}
              className="flex cursor-pointer items-center justify-between"
              aria-label={`${heading} ${year}`}
            >
              <span className={active ? "font-bold" : ""}>{year}</span>
              {active && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Joined-year range filter.
 *
 * Years are generated client-side rather than fetched: there is no distinct-year
 * endpoint, and a fixed floor covers every plausible joiner without a request.
 */
export function JoinedYearFilterMenu({ from, to, onChange }: JoinedYearFilterMenuProps) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - YEAR_FLOOR + 1 }, (_, i) => currentYear - i);

  const label = from && to ? t("user.filter.year.range", { from, to })
    : from ? t("user.filter.year.fromOnly", { from })
    : to ? t("user.filter.year.toOnly", { to })
    : t("user.filter.all");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger active={from !== "" || to !== ""}>
          {`${t("user.filter.year")}: ${label}`}
        </FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <div className="grid grid-cols-2 gap-2">
          <YearColumn
            heading={t("user.filter.year.from")}
            years={years}
            value={from}
            // An inverted range shows nothing, so the opposite bound yields.
            onPick={(next) => onChange({ from: next, to: to && next > to ? "" : to })}
          />
          <YearColumn
            heading={t("user.filter.year.to")}
            years={years}
            value={to}
            onPick={(next) => onChange({ from: from && next < from ? "" : from, to: next })}
          />
        </div>
        <DropdownMenuItem
          onClick={() => onChange({ from: "", to: "" })}
          className="mt-1 cursor-pointer justify-center border-t border-gray-100 pt-2 text-sm"
        >
          {t("user.filter.year.reset")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
