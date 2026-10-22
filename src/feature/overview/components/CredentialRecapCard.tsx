import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useCredentialRecap } from "../api/useCredentialRecap";
import {
  defaultRecapColumns,
  filterRecap,
  groupRecap,
  readRecapFilters,
  setRecapFilter,
  sortRecap,
  sumRecap,
  type RecapDirection,
  type RecapGrouping,
  type RecapSort,
} from "../lib/credential-recap";
import { flattenUnitTree, pathSegments } from "@shared/lib/units";
import type { CredentialRecapRow, HolderUnitDTO } from "@shared/types/api";
import { Card } from "@ui/card";
import { Button } from "@ui/button";
import { Skeleton } from "@ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { FilterTrigger } from "@shared/components/FilterTrigger";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";

const PAGE_SIZE = 10;
const groupingLabels: Record<RecapGrouping, string> = {
  "unit-year": "unitYear",
  unit: "unit",
  year: "year",
};
const optionalColumns: RecapSort[] = [
  "total_holders",
  "holders_with_credentials",
  "holders_without_credentials",
  "holders_with_active_credentials",
  "holders_without_active_credentials",
  "total_credentials",
  "active_credentials",
  "pending_credentials",
  "rejected_credentials",
  "expired_credentials",
  "revoked_credentials",
];

export function CredentialRecapCard() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { data, isPending, isRefetchError, refetch } = useCredentialRecap();
  const [grouping, setGrouping] = useState<RecapGrouping>("unit-year");
  const [columns, setColumns] = useState<RecapSort[]>(defaultRecapColumns);
  const [sort, setSort] = useState<RecapSort>("unit_id");
  const [direction, setDirection] = useState<RecapDirection>("asc");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const prevUnit = useRef(params.get("recap_unit"));
  const prevYear = useRef(params.get("recap_year"));
  useEffect(() => {
    const unit = params.get("recap_unit");
    const year = params.get("recap_year");
    if (unit !== prevUnit.current || year !== prevYear.current) {
      prevUnit.current = unit;
      prevYear.current = year;
      setVisible(PAGE_SIZE);
    }
  }, [params]);
  const label = (key: string) => t(`overview.recap.${key}`);
  const filters = data ? readRecapFilters(params, data) : { unit: null, year: null };
  const filtered = data ? filterRecap(data, filters.unit, filters.year) : [];
  const grouped = groupRecap(filtered, grouping);
  const sorted = sortRecap(grouped, data?.units ?? [], sort, direction);
  const totals = sumRecap(filtered);
  const units = (data?.units ?? []).map((unit) => ({
    ...unit,
    created_at: "",
    updated_at: null,
  })) satisfies HolderUnitDTO[];
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const unitName = (id: string | null) =>
    id === null
      ? label("unassigned")
      : pathSegments(
          byId.get(id) ?? {
            id,
            parent_id: null,
            name: id,
            active: false,
            created_at: "",
            updated_at: null,
          },
          byId,
        ).join(" > ");
  const years = Array.from(new Set(data?.rows.map((row) => row.joined_year) ?? [])).sort((a, b) =>
    a === null ? 1 : b === null ? -1 : b - a,
  );
  const activeColumns = columns.filter(
    (column) => column !== "unit_id" && column !== "joined_year",
  );
  const shownColumns: RecapSort[] = [
    ...(grouping !== "year" ? ["unit_id" as const] : []),
    ...(grouping !== "unit" ? ["joined_year" as const] : []),
    ...activeColumns,
  ];
  const changeFilter = (key: "recap_unit" | "recap_year", value: string | null) => {
    setVisible(PAGE_SIZE);
    setParams((previous) => setRecapFilter(previous, key, value));
  };
  const clearFilters = () => {
    setVisible(PAGE_SIZE);
    setParams((previous) => {
      const next = setRecapFilter(previous, "recap_unit", null);
      return setRecapFilter(next, "recap_year", null);
    });
  };
  const valueOf = (row: CredentialRecapRow, column: RecapSort) =>
    column === "unit_id"
      ? unitName(row.unit_id)
      : column === "joined_year"
        ? (row.joined_year ?? label("unknown"))
        : row[column].toLocaleString(i18n.language);
  const header = (column: RecapSort) => label(`column.${column}`);
  const onSort = (column: RecapSort) => {
    setSort(column);
    setDirection(sort === column && direction === "asc" ? "desc" : "asc");
  };

  return (
    <Card className="min-w-0 overflow-hidden p-5 sm:p-6" aria-label={label("title")}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-navy">
            {label("title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {label("scope")}
            {data && (
              <>
                {" "}
                ·{" "}
                <time dateTime={data.as_of}>
                  {new Date(data.as_of).toLocaleString(i18n.language)}
                </time>
              </>
            )}
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs font-medium text-navy hover:bg-gray-50 hover:text-navy"
            >
              <Info className="mr-1.5 h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
              {label("definitions")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{label("definitions")}</DialogTitle>
              <DialogDescription className="sr-only">{label("definitions")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm leading-relaxed text-gray-600">
              <p>{label("definitionText")}</p>
              <p className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
                {label("scopeNote")}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {isPending && !data ? (
        <div aria-label={label("loading")} className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : !data ? (
        <EmptyState
          icon={AlertTriangle}
          title={label("error")}
          description={label("errorDescription")}
          action={<Button onClick={() => refetch()}>{t("overview.error.retry")}</Button>}
        />
      ) : (
        <>
          {isRefetchError && (
            <p role="status" className="mb-4 rounded-lg bg-gold/10 p-3 text-sm text-navy">
              {label("stale")}
            </p>
          )}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <FilterTrigger active={!!filters.unit} className="max-w-full">
                    <span className="min-w-0 truncate">
                      {label("unit")}:{" "}
                      {filters.unit === "unassigned"
                        ? label("unassigned")
                        : filters.unit
                          ? unitName(filters.unit)
                          : label("all")}
                    </span>
                  </FilterTrigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="max-h-80 max-w-[min(90vw,24rem)] overflow-y-auto"
                  align="start"
                >
                  <DropdownMenuItem onClick={() => changeFilter("recap_unit", null)}>
                    {label("all")}
                  </DropdownMenuItem>
                  {flattenUnitTree(units).map((unit) => (
                    <DropdownMenuItem
                      key={unit.id}
                      onClick={() => changeFilter("recap_unit", unit.id)}
                      style={{ paddingLeft: `${0.5 + unit.depth * 0.85}rem` }}
                    >
                      {unit.name}
                    </DropdownMenuItem>
                  ))}
                  {data.rows.some((row) => row.unit_id === null) && (
                    <DropdownMenuItem onClick={() => changeFilter("recap_unit", "unassigned")}>
                      {label("unassigned")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <FilterTrigger active={!!filters.year}>
                    {label("year")}:{" "}
                    {filters.year === "unknown" ? label("unknown") : (filters.year ?? label("all"))}
                  </FilterTrigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => changeFilter("recap_year", null)}>
                    {label("all")}
                  </DropdownMenuItem>
                  {years.map((year) => (
                    <DropdownMenuItem
                      key={year ?? "unknown"}
                      onClick={() =>
                        changeFilter("recap_year", year === null ? "unknown" : String(year))
                      }
                    >
                      {year ?? label("unknown")}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <FilterTrigger>
                    {label("group")}: {label(`grouping.${groupingLabels[grouping]}`)}
                  </FilterTrigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(["unit-year", "unit", "year"] as RecapGrouping[]).map((value) => (
                    <DropdownMenuItem
                      key={value}
                      onClick={() => {
                        setGrouping(value);
                        setVisible(PAGE_SIZE);
                        if (sort === "unit_id" && value === "year") setSort("joined_year");
                        if (sort === "joined_year" && value === "unit") setSort("unit_id");
                      }}
                    >
                      {label(`grouping.${groupingLabels[value]}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <FilterTrigger>{label("columns")}</FilterTrigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-80 overflow-y-auto" align="start">
                  {optionalColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column}
                      checked={columns.includes(column)}
                      disabled={activeColumns.length === 1 && columns.includes(column)}
                      onCheckedChange={(checked) =>
                        setColumns((prev) =>
                          checked ? [...prev, column] : prev.filter((item) => item !== column),
                        )
                      }
                    >
                      {header(column)}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setColumns(defaultRecapColumns)}>
                    {label("resetColumns")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {data.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">{label("empty")}</p>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              <p>{label("noMatches")}</p>
              <Button variant="outline" className="mt-3" onClick={clearFilters}>
                {label("clearFilters")}
              </Button>
            </div>
          ) : (
            <>
              <Table className="min-w-max" aria-label={label("title")}>
                <TableHeader>
                  <TableRow>
                    {shownColumns.map((column) => (
                      <TableHead
                        key={column}
                        aria-sort={
                          sort === column
                            ? direction === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={column !== "unit_id" ? "text-right" : undefined}
                      >
                        <button
                          className="rounded text-inherit hover:text-gold-text focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                          onClick={() => onSort(column)}
                        >
                          {header(column)}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.slice(0, visible).map((row) => (
                    <TableRow key={`${row.unit_id ?? "null"}-${row.joined_year ?? "null"}`}>
                      {shownColumns.map((column) => (
                        <TableCell
                          key={column}
                          className={
                            column === "unit_id"
                              ? "max-w-72 font-medium whitespace-normal text-navy"
                              : "font-tabular text-right text-navy"
                          }
                        >
                          {valueOf(row, column)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="bg-gold/10 font-bold" aria-label={label("total")}>
                    {shownColumns.map((column) => (
                      <TableCell
                        key={column}
                        className={
                          column === "unit_id" || column === "joined_year"
                            ? "text-navy"
                            : "font-tabular text-right text-navy"
                        }
                      >
                        {column === shownColumns[0]
                          ? label("total")
                          : column === "unit_id" || column === "joined_year"
                            ? ""
                            : totals[column].toLocaleString(i18n.language)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
              <LoadMoreBar
                total={sorted.length}
                hasMore={visible < sorted.length}
                isLoading={false}
                onLoadMore={() => setVisible((current) => current + PAGE_SIZE)}
                countLabel={t("overview.recap.rowCount", {
                  shown: Math.min(visible, sorted.length),
                  total: sorted.length,
                })}
              />
            </>
          )}
        </>
      )}
    </Card>
  );
}
