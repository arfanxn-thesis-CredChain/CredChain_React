import { Check, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RoleGate } from "@shared/auth/guards";
import { Role, canAccess } from "@shared/auth/role";
import { useStore } from "@app/store";
import { ReferenceCreateForm } from "@shared/components/reference/ReferenceCreateForm";
import { ReferenceSubmitForm } from "@shared/components/reference/ReferenceSubmitForm";
import type { ReferenceResource, ReferenceRow } from "@shared/types/api";
import { FilterTrigger } from "@shared/components/FilterTrigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { Input } from "@ui/input";
import { cn } from "@shared/lib/cn";

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
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="max-w-full min-w-0 lg:w-fit">
          <RoleGate
            allowed={[Role.ADMIN, Role.SUPER_ADMIN]}
            fallback={<ReferenceSubmitForm resource={resource} />}
          >
            <ReferenceCreateForm resource={resource} rows={rows} submitLabel={createLabel} />
          </RoleGate>
        </div>
        {onStatusFilterChange && (
          <div className="shrink-0 self-start lg:self-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <FilterTrigger active={selected !== "active"}>
                  {t("cred.references.column.status")}:{" "}
                  {t(
                    options.find((o) => o.key === selected)?.labelKey ??
                      "cred.references.filter.all",
                  )}
                </FilterTrigger>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {options.map((opt) => (
                  <DropdownMenuItem
                    key={opt.key}
                    onClick={() => onStatusFilterChange(opt.key)}
                    className={cn(
                      "flex items-center justify-between gap-2",
                      selected === opt.key && "font-bold",
                    )}
                  >
                    <span>{t(opt.labelKey)}</span>
                    {selected === opt.key && <Check className="h-4 w-4 text-gold" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}
