import { Search, RefreshCw } from "lucide-react";
import { useReferencePendingCount } from "@shared/api/useReferenceData";
import { Button } from "@ui/button";
import { useTranslation } from "react-i18next";
import { RoleGate } from "@shared/auth/guards";
import { Role, canAccess } from "@shared/auth/role";
import { useStore } from "@app/store";
import { ReferenceCreateForm } from "@shared/components/reference/ReferenceCreateForm";
import { ReferenceSubmitForm } from "@shared/components/reference/ReferenceSubmitForm";
import type { ReferenceResource, ReferenceRow } from "@shared/types/api";
import { Input } from "@ui/input";

import type { ReferenceFilter } from "@shared/hooks/useReferenceStatusFilter";
export type { ReferenceFilter } from "@shared/hooks/useReferenceStatusFilter";

export interface ReferenceToolbarProps {
  resource: ReferenceResource;
  rows: ReferenceRow[];
  createLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  statusFilter?: ReferenceFilter;
  onStatusFilterChange?: (status: ReferenceFilter) => void;
}

const STATUS_OPTIONS: { key: ReferenceFilter; labelKey: string }[] = [
  { key: "active", labelKey: "cred.references.filter.active" },
  { key: "all", labelKey: "cred.references.filter.all" },
  { key: "approved", labelKey: "cred.references.filter.approved" },
  { key: "inactive", labelKey: "cred.references.filter.inactive" },
  { key: "pending", labelKey: "cred.references.filter.pending" },
  { key: "rejected", labelKey: "cred.references.filter.rejected" },
];

export function ReferenceToolbar({
  resource,
  rows,
  createLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  statusFilter,
  onStatusFilterChange,
}: ReferenceToolbarProps) {
  const { t } = useTranslation();
  const user = useStore((s) => s.user);
  const canFilterInactive = canAccess(user?.role, Role.ISSUER);
  const pendingCount = useReferencePendingCount(resource);
  const options = STATUS_OPTIONS.filter((option) => option.key !== "inactive" || canFilterInactive);
  const selected =
    statusFilter === "inactive" && !canFilterInactive ? "active" : (statusFilter ?? "active");
  const placeholder = searchPlaceholder ?? t("admin.searchPlaceholder");

  return (
    <div className="space-y-4 border-b border-gray-50 p-4 sm:p-6">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="w-full md:max-w-md">
          <Input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            leadingIcon={Search}
            placeholder={placeholder}
            aria-label={placeholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      {onStatusFilterChange && (
        <div
          role="group"
          aria-label={t("cred.references.column.status")}
          className="flex flex-wrap items-center gap-2"
        >
          {options.map((opt) => (
            <Button
              key={opt.key}
              type="button"
              variant={selected === opt.key ? "primary" : "outline"}
              size="sm"
              aria-pressed={selected === opt.key}
              onClick={() => onStatusFilterChange(opt.key)}
              className="focus-visible:ring-navy"
            >
              {t(opt.labelKey)}
              {opt.key === "pending" && canFilterInactive && (
                <span
                  className="rounded-full bg-gold px-1.5 text-[10px] font-bold text-navy"
                  aria-label={
                    pendingCount.isError
                      ? t("notifications.review.unavailable")
                      : pendingCount.isLoading
                        ? t("notifications.review.loading")
                        : t("notifications.review.count", { count: pendingCount.data ?? 0 })
                  }
                >
                  {pendingCount.isError || pendingCount.isLoading ? "…" : pendingCount.data}
                </span>
              )}
            </Button>
          ))}
          {canFilterInactive && pendingCount.isError && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => pendingCount.refetch()}
              aria-label={t("notifications.pendingReviewCard.retry")}
              title={t("notifications.review.unavailable")}
              className="focus-visible:ring-navy"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("notifications.pendingReviewCard.retry")}
            </Button>
          )}
        </div>
      )}
      <div className="w-full max-w-full min-w-0">
        <RoleGate
          allowed={[Role.ADMIN, Role.SUPER_ADMIN]}
          fallback={<ReferenceSubmitForm resource={resource} />}
        >
          <ReferenceCreateForm resource={resource} rows={rows} submitLabel={createLabel} />
        </RoleGate>
      </div>
    </div>
  );
}
