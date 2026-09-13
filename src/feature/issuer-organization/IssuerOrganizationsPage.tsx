import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { useIssuerOrganizations } from "./api/useIssuerOrganizations";
import {
  useDestroyIssuerOrganization,
  useUpdateIssuerOrganization,
} from "./api/useMutateIssuerOrganizations";
import { isApiError } from "@shared/api/envelope";
import { ActiveSwitch } from "@shared/components/ActiveSwitch";
import { BackLink } from "@shared/components/BackLink";
import { InlineRenameForm } from "@shared/components/InlineRenameForm";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";
import { PageHeader } from "@shared/components/PageHeader";
import { ReferenceTable } from "@shared/components/reference/ReferenceTable";
import { ReferenceToolbar } from "@shared/components/reference/ReferenceToolbar";
import { useDebouncedSearchParam } from "@shared/hooks/useSearchParam";
import { RoleGate } from "@shared/auth/guards";
import { Role } from "@shared/auth/role";
import { cn } from "@shared/lib/cn";
import type { ReferenceRow } from "@shared/types/api";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { useConfirm } from "@ui/confirm-dialog";

const ADMIN_ROLES = [Role.ADMIN, Role.SUPER_ADMIN];

export function IssuerOrganizationsPage() {
  const { t } = useTranslation();
  const { input, setInput, search } = useDebouncedSearchParam();
  const list = useIssuerOrganizations({ search });
  const update = useUpdateIssuerOrganization();
  const destroy = useDestroyIssuerOrganization();
  const { confirm, dialog } = useConfirm();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const rows = list.items;

  const setRowError = (id: string, key: string) => {
    setRowErrors((prev) => ({ ...prev, [id]: key }));
  };

  const clearRowError = (id: string) => {
    setRowErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const submitRename = (row: ReferenceRow, name: string) => {
    update.mutate(
      { id: row.id, name, active: row.active !== false },
      {
        onSuccess: () => {
          setRenamingId(null);
          clearRowError(row.id);
        },
        onError: (error) => {
          setRowError(row.id, isApiError(error) ? error.messageKey : "admin.issuerOrg.actionError");
        },
      },
    );
  };

  const handleToggleActive = (row: ReferenceRow) => {
    update.mutate(
      { id: row.id, name: row.name, active: row.active === false ? true : false },
      {
        onSuccess: () => clearRowError(row.id),
        onError: (error) => {
          setRowError(row.id, isApiError(error) ? error.messageKey : "admin.issuerOrg.actionError");
        },
      },
    );
  };

  const handleDestroy = async (row: ReferenceRow) => {
    const ok = await confirm({
      title: t("issuerOrg.destroy.title", { name: row.name }),
      description: t("issuerOrg.destroy.description"),
      confirmLabel: t("issuerOrg.destroy.confirm"),
      cancelLabel: t("common.cancel"),
      tone: "destructive",
    });
    if (ok) {
      destroy.mutate(row.id, {
        onError: (error) => {
          setRowError(row.id, isApiError(error) ? error.messageKey : "admin.issuerOrg.actionError");
        },
      });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <BackLink />
      <PageHeader title={t("issuerOrg.title")} description={t("issuerOrg.description")} />

      <Card className="p-0">
        <ReferenceToolbar
          resource="credential-issuer-organizations"
          rows={rows}
          createLabel={t("issuerOrg.createAction")}
          searchValue={input}
          onSearchChange={setInput}
        />

        <ReferenceTable
          rows={rows}
          isLoading={list.isLoading}
          isError={list.isError}
          searchActive={search.length > 0}
          nameLabel={t("issuerOrg.column.name")}
          actionsLabel={t("issuerOrg.actionsMenu")}
          emptyIcon={Building2}
          emptyTitle={t("issuerOrg.empty.title")}
          emptyDescription={t("issuerOrg.empty.description")}
          renderName={(row) =>
            renamingId === row.id ? (
              <InlineRenameForm
                initialValue={row.name}
                isPending={update.isPending}
                error={rowErrors[row.id]}
                onSubmit={(name) => submitRename(row, name)}
                onCancel={() => {
                  setRenamingId(null);
                  clearRowError(row.id);
                }}
              />
            ) : (
              <div>
                <span
                  className={cn(
                    "text-sm font-medium text-navy",
                    row.active === false && "line-through opacity-60",
                  )}
                >
                  {row.name}
                </span>
                {rowErrors[row.id] && (
                  <p role="alert" className="mt-1 text-xs text-error">
                    {t(rowErrors[row.id])}
                  </p>
                )}
              </div>
            )
          }
          actions={(row) =>
            renamingId === row.id ? null : (
              <RoleGate allowed={ADMIN_ROLES}>
                <div className="flex shrink-0 items-center justify-end gap-0.5">
                  <ActiveSwitch
                    checked={row.active !== false}
                    label={t("issuerOrg.activeToggle", { name: row.name })}
                    onCheckedChange={() => handleToggleActive(row)}
                  />
                  <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("common.edit")}
                    onClick={() => {
                      clearRowError(row.id);
                      setRenamingId(row.id);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("issuerOrg.destroy.menu")}
                    onClick={() => void handleDestroy(row)}
                  >
                    <Trash2 className="h-4 w-4 text-error" />
                  </Button>
                </div>
              </RoleGate>
            )
          }
        />

        {rows.length > 0 && (
          <LoadMoreBar
            total={list.total}
            hasMore={list.hasMore}
            isLoading={list.isFetchingNextPage}
            onLoadMore={list.loadMore}
            countLabel={t("admin.count", { shown: rows.length, total: list.total })}
          />
        )}
      </Card>
      {dialog}
    </div>
  );
}
