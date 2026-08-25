import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useIssuerOrganizations } from "./api/useIssuerOrganizations";
import {
  useDestroyIssuerOrganization,
  useUpdateIssuerOrganization,
} from "./api/useMutateIssuerOrganizations";
import { BackLink } from "@shared/components/BackLink";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";
import { PageHeader } from "@shared/components/PageHeader";
import { ResourceAdminEditForm } from "@shared/components/admin/ResourceAdminEditForm";
import { ResourceAdminTable } from "@shared/components/admin/ResourceAdminTable";
import { ResourceAdminToolbar } from "@shared/components/admin/ResourceAdminToolbar";
import { useDebouncedSearchParam } from "@shared/hooks/useSearchParam";
import { RoleGate } from "@shared/auth/guards";
import { Role } from "@shared/auth/role";
import type { ReferenceRow } from "@shared/types/api";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { useConfirm } from "@ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

export function IssuerOrganizationsPage() {
  const { t } = useTranslation();
  const { input, setInput, search } = useDebouncedSearchParam();
  const list = useIssuerOrganizations({ search });
  const update = useUpdateIssuerOrganization();
  const destroy = useDestroyIssuerOrganization();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<ReferenceRow | null>(null);

  const rows = list.items;

  const handleDestroy = async (row: ReferenceRow) => {
    const ok = await confirm({
      title: t("issuerOrg.destroy.title", { name: row.name }),
      description: t("issuerOrg.destroy.description"),
      confirmLabel: t("issuerOrg.destroy.confirm"),
      cancelLabel: t("common.cancel"),
      tone: "destructive",
    });
    if (ok) destroy.mutate(row.id);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <BackLink />
      <PageHeader title={t("issuerOrg.title")} description={t("issuerOrg.description")} />

      <Card className="p-0">
        <ResourceAdminToolbar
          resource="credential-issuer-organizations"
          rows={rows}
          createLabel={t("issuerOrg.createAction")}
          searchValue={input}
          onSearchChange={setInput}
        />

        <ResourceAdminTable
          rows={rows}
          isLoading={list.isLoading}
          isError={list.isError}
          searchActive={search.length > 0}
          nameLabel={t("issuerOrg.column.name")}
          actionsLabel={t("issuerOrg.actionsMenu")}
          emptyIcon={Building2}
          emptyTitle={t("issuerOrg.empty.title")}
          emptyDescription={t("issuerOrg.empty.description")}
          actions={(row) => (
            <RoleGate allowed={[Role.ADMIN, Role.SUPER_ADMIN]}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("issuerOrg.actionsMenu")}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(row)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("common.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onClick={() => void handleDestroy(row)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("issuerOrg.destroy.menu")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </RoleGate>
          )}
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

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("issuerOrg.editTitle")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ResourceAdminEditForm
              name={editing.name}
              nameLabel={t("issuerOrg.column.name")}
              isPending={update.isPending}
              onSubmit={(values) => {
                update.mutate({ id: editing.id, name: values.name });
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}
