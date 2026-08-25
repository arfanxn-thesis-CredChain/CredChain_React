import { useTranslation } from "react-i18next";
import { SearchX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@shared/components/EmptyState";
import type { ReferenceRow } from "@shared/types/api";
import { Skeleton } from "@ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";

interface ResourceAdminTableProps {
  rows: ReferenceRow[];
  isLoading?: boolean;
  isError?: boolean;
  nameLabel: string;
  activeLabel?: string;
  actionsLabel?: string;
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon: LucideIcon;
  /** True when a search term is active — swaps "nothing here yet" for "no results". */
  searchActive?: boolean;
  errorText?: string;
  renderActive?: (row: ReferenceRow) => ReactNode;
  actions?: (row: ReferenceRow) => ReactNode;
}

export function ResourceAdminTable({
  rows,
  isLoading = false,
  isError = false,
  nameLabel,
  activeLabel,
  actionsLabel,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon,
  searchActive = false,
  errorText,
  renderActive,
  actions,
}: ResourceAdminTableProps) {
  const { t } = useTranslation();
  const hasActive = Boolean(activeLabel && renderActive);
  const hasActions = Boolean(actionsLabel && actions);

  if (isError) {
    return <div className="p-12 text-center text-sm text-error">{errorText ?? t("admin.loadError")}</div>;
  }

  if (rows.length === 0 && !isLoading) {
    return (
      <EmptyState
        icon={searchActive ? SearchX : EmptyIcon}
        title={searchActive ? t("admin.empty.search.title") : emptyTitle}
        description={searchActive ? t("admin.empty.search.body") : emptyDescription}
        className="rounded-none border-0 shadow-none"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{nameLabel}</TableHead>
            {hasActive && <TableHead>{activeLabel}</TableHead>}
            {hasActions && (
              <TableHead className="relative">
                <span className="sr-only">{actionsLabel}</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  {hasActive && (
                    <TableCell>
                      <Skeleton className="h-5 w-10" />
                    </TableCell>
                  )}
                  {hasActions && (
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="text-sm font-medium text-navy">{row.name}</span>
                  </TableCell>
                  {hasActive && <TableCell>{renderActive?.(row)}</TableCell>}
                  {hasActions && <TableCell className="text-right">{actions?.(row)}</TableCell>}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
