import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Check, Pencil, Trash2, X } from "lucide-react";
import { useIssuerOrganizations } from "./api/useIssuerOrganizations";
import {
  useDestroyIssuerOrganization,
  useUpdateIssuerOrganization,
} from "./api/useMutateIssuerOrganizations";
import { useApproveReference, useRejectReference } from "@shared/api/useReferenceData";
import { isApiError } from "@shared/api/envelope";
import { useStore } from "@app/store";
import { Role, canAccessAny } from "@shared/auth/role";
import { ActiveSwitch } from "@shared/components/ActiveSwitch";
import { BackLink } from "@shared/components/BackLink";
import { InlineRenameForm } from "@shared/components/InlineRenameForm";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";
import { PageHeader } from "@shared/components/PageHeader";
import {
  ReferenceTable,
  ReferenceName,
  getReferenceStatus,
} from "@shared/components/reference/ReferenceTable";
import { ReferenceToolbar } from "@shared/components/reference/ReferenceToolbar";
import { ReferenceRejectForm } from "@shared/components/reference/ReferenceRejectForm";
import { useReferenceStatusFilter } from "@shared/hooks/useReferenceStatusFilter";
import { useDebouncedSearchParam } from "@shared/hooks/useSearchParam";
import type { ReferenceRow } from "@shared/types/api";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { ConfirmDialog, useConfirm } from "@ui/confirm-dialog";

const ADMIN_ROLES = [Role.ADMIN, Role.SUPER_ADMIN];
const REVIEW_ROLES = [Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN];

export function IssuerOrganizationsPage() {
  const { t } = useTranslation();
  const user = useStore((s) => s.user);
  const isAdmin = canAccessAny(user?.role, ADMIN_ROLES);
  const canReview = canAccessAny(user?.role, REVIEW_ROLES);

  const { input, setInput, search } = useDebouncedSearchParam();
  const [effectiveFilter, setStatusFilter] = useReferenceStatusFilter(canReview);
  const list = useIssuerOrganizations({
    search,
    status:
      effectiveFilter === "all"
        ? undefined
        : effectiveFilter === "inactive" || effectiveFilter === "active"
          ? "approved"
          : effectiveFilter,
    active:
      effectiveFilter === "active" ? true : effectiveFilter === "inactive" ? false : undefined,
  });
  const update = useUpdateIssuerOrganization();
  const destroy = useDestroyIssuerOrganization();
  const approve = useApproveReference("credential-issuer-organizations");
  const reject = useRejectReference("credential-issuer-organizations");
  const { confirm, dialog } = useConfirm();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [rejectingRow, setRejectingRow] = useState<ReferenceRow | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const rows = list.items;
  const context = JSON.stringify([user?.id, user?.role, input, effectiveFilter]);
  const [editorContext, setEditorContext] = useState(context);
  const editorSession = useRef({});
  useLayoutEffect(() => {
    editorSession.current = {};
  }, [context, renamingId, rejectingRow]);
  if (editorContext !== context) {
    setEditorContext(context);
    setApprovingId(null);
    setRenamingId(null);
    setRejectingRow(null);
    setRowErrors({});
  }
  if (
    rejectingRow &&
    !list.isLoading &&
    !rows.some((row) => row.id === rejectingRow.id && getReferenceStatus(row) === "pending")
  ) {
    setRejectingRow(null);
  }

  if (
    renamingId &&
    !list.isLoading &&
    (!isAdmin ||
      !rows.some((row) => row.id === renamingId && getReferenceStatus(row) === "approved"))
  ) {
    setRenamingId(null);
  }

  const approvalTarget =
    canReview && editorContext === context && !list.isError
      ? rows.find((row) => row.id === approvingId && getReferenceStatus(row) === "pending")
      : undefined;
  if (approvingId && !approvalTarget) setApprovingId(null);
  const actionsLocked =
    Boolean(approvingId || dialog) ||
    approve.isPending ||
    reject.isPending ||
    update.isPending ||
    destroy.isPending;
  const confirmApproval = () => {
    if (
      !approvalTarget ||
      editorContext !== context ||
      !canReview ||
      approve.isPending ||
      reject.isPending ||
      update.isPending ||
      destroy.isPending ||
      dialog
    )
      return;
    setApprovingId(null);
    approve.mutate(approvalTarget.id);
  };

  const submitRejection = (row: ReferenceRow, reason: string) => {
    if (
      !canReview ||
      reject.isPending ||
      update.isPending ||
      rejectingRow?.id !== row.id ||
      getReferenceStatus(row) !== "pending" ||
      !rows.some((item) => item.id === row.id)
    )
      return;
    clearRowError(row.id);
    const session = editorSession.current;
    reject.mutate(
      { id: row.id, rejection_reason: reason },
      {
        onSuccess: () => {
          if (editorSession.current !== session) return;
          setRejectingRow((current) => (current?.id === row.id ? null : current));
        },
        onError: (error) => {
          if (editorSession.current !== session) return;
          setRowError(row.id, isApiError(error) ? error.messageKey : "cred.references.rejectError");
        },
      },
    );
  };

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
    if (!isAdmin || update.isPending || reject.isPending || renamingId !== row.id) return;
    const session = editorSession.current;
    update.mutate(
      { id: row.id, name, active: row.active !== false },
      {
        onSuccess: () => {
          if (editorSession.current !== session) return;
          setRenamingId(null);
          clearRowError(row.id);
        },
        onError: (error) => {
          if (editorSession.current !== session) return;
          setRowError(row.id, isApiError(error) ? error.messageKey : "admin.issuerOrg.actionError");
        },
      },
    );
  };

  const handleToggleActive = (row: ReferenceRow) => {
    if (actionsLocked) return;
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
    if (actionsLocked) return;
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
          statusFilter={effectiveFilter}
          onStatusFilterChange={setStatusFilter}
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
          renderRowContent={(row) =>
            rejectingRow?.id === row.id && canReview && getReferenceStatus(row) === "pending" ? (
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 break-words">
                  <ReferenceName row={row} />
                </div>
                <ReferenceRejectForm
                  key={row.id}
                  isPending={reject.isPending}
                  error={rowErrors[row.id]}
                  onSubmit={(reason) => submitRejection(row, reason)}
                  onCancel={() => {
                    if (reject.isPending) return;
                    setRejectingRow(null);
                    clearRowError(row.id);
                  }}
                />
              </div>
            ) : null
          }
          renderName={(row) =>
            renamingId === row.id ? (
              <InlineRenameForm
                initialValue={row.name}
                isPending={update.isPending}
                error={rowErrors[row.id]}
                onSubmit={(name) => submitRename(row, name)}
                onCancel={() => {
                  if (update.isPending) return;
                  setRenamingId(null);
                  clearRowError(row.id);
                }}
              />
            ) : (
              <div>
                <ReferenceName row={row} />
                {row.rejection_reason && (
                  <p className="mt-0.5 text-xs text-error">
                    {t("cred.references.rejectionReason", { reason: row.rejection_reason })}
                  </p>
                )}
                {rowErrors[row.id] && (
                  <p role="alert" className="mt-1 text-xs text-error">
                    {t(rowErrors[row.id])}
                  </p>
                )}
              </div>
            )
          }
          actions={(row) => {
            if (renamingId === row.id || rejectingRow?.id === row.id) return null;

            const status = getReferenceStatus(row);
            if (status === "pending") {
              if (!canReview) return null;
              return (
                <div className="flex shrink-0 items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("common.approve")}
                    title={t("common.approve")}
                    disabled={actionsLocked}
                    onClick={() => {
                      if (actionsLocked) return;
                      setRenamingId(null);
                      setRejectingRow(null);
                      setApprovingId(row.id);
                    }}
                    className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <Check aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("common.reject")}
                    title={t("common.reject")}
                    disabled={actionsLocked}
                    onClick={() => {
                      if (actionsLocked) return;
                      setRenamingId(null);
                      clearRowError(row.id);
                      setRejectingRow(row);
                    }}
                    className="text-error hover:bg-error/10 hover:text-error"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              );
            }

            if (!isAdmin) return null;
            return (
              <div className="flex shrink-0 items-center justify-end gap-0.5">
                {status === "approved" && (
                  <>
                    <ActiveSwitch
                      disabled={actionsLocked}
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
                      disabled={actionsLocked}
                      onClick={() => {
                        clearRowError(row.id);
                        if (actionsLocked) return;
                        setRejectingRow(null);
                        setRenamingId(row.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("issuerOrg.destroy.menu")}
                  disabled={actionsLocked}
                  onClick={() => void handleDestroy(row)}
                >
                  <Trash2 className="h-4 w-4 text-error" />
                </Button>
              </div>
            );
          }}
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
      {approvalTarget && (
        <ConfirmDialog
          open
          title={t("cred.references.approveConfirm.title", { name: approvalTarget.name })}
          description={t("cred.references.approveConfirm.description", {
            name: approvalTarget.name,
          })}
          confirmLabel={t("common.approve")}
          cancelLabel={t("common.cancel")}
          onConfirm={confirmApproval}
          onCancel={() => setApprovingId(null)}
        />
      )}
      {dialog}
    </div>
  );
}
