import { useTranslation } from "react-i18next";
import { CircleDashed, SearchX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@shared/components/EmptyState";
import type { ReferenceRow, ReferenceStatus } from "@shared/types/api";
import { cn } from "@shared/lib/cn";
import { Skeleton } from "@ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";

export interface ReferenceTableProps {
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
  renderRowContent?: (row: ReferenceRow) => ReactNode;
  renderName?: (row: ReferenceRow) => ReactNode;
  renderActive?: (row: ReferenceRow) => ReactNode;
  actions?: (row: ReferenceRow) => ReactNode;
}

export function getReferenceStatus(row: ReferenceRow): ReferenceStatus {
  if (row.status) return row.status;
  if (row.rejected_at) return "rejected";
  if (row.activated_at) return "approved";
  return "pending";
}

export function ReferenceName({ row }: { row: ReferenceRow }) {
  const { t } = useTranslation();
  const status = getReferenceStatus(row);

  return (
    <span className="inline-flex items-center gap-1.5">
      {status === "pending" && (
        <span
          title={t("cred.references.status.pending")}
          className="inline-flex shrink-0 text-gray-500"
        >
          <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">{t("cred.references.status.pending")}</span>
        </span>
      )}
      {status === "rejected" && (
        <span className="sr-only">{t("cred.references.status.rejected")}</span>
      )}
      <span
        className={cn(
          "min-w-0 text-sm font-medium text-navy",
          status === "approved" && row.active === false && "line-through opacity-60",
          status === "rejected" && "text-error",
        )}
      >
        {row.name}
      </span>
    </span>
  );
}

export function ReferenceTable({
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
  renderName,
  renderRowContent,
  renderActive,
  actions,
}: ReferenceTableProps) {
  const { t } = useTranslation();
  const hasActive = Boolean(activeLabel && renderActive);
  const hasActions = Boolean(actionsLabel && actions);

  if (isError) {
    return (
      <div className="p-12 text-center text-sm text-error">{errorText ?? t("admin.loadError")}</div>
    );
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
                      <Skeleton className="ml-auto h-8 w-28 rounded-lg" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            : rows.map((row) => {
                const content = renderRowContent?.(row);
                if (content != null) {
                  return (
                    <TableRow key={row.id}>
                      <TableCell
                        colSpan={1 + Number(hasActive) + Number(hasActions)}
                        className="min-w-0 whitespace-normal"
                      >
                        {content}
                      </TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {renderName ? (
                        renderName(row)
                      ) : (
                        <div>
                          <ReferenceName row={row} />
                          {row.rejection_reason && (
                            <p className="mt-0.5 text-xs text-error">
                              {t("cred.references.rejectionReason", {
                                reason: row.rejection_reason,
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {hasActive && <TableCell>{renderActive?.(row)}</TableCell>}
                    {hasActions && <TableCell className="text-right">{actions?.(row)}</TableCell>}
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </div>
  );
}
