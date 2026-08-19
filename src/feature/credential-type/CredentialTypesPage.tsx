import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useCredentialTypes } from "./api/useCredentialTypes";
import { useDestroyCredentialType, useUpdateCredentialType } from "./api/useMutateCredentialTypes";
import { PageHeader } from "@shared/components/PageHeader";
import { ResourceAdminCreateForm } from "@shared/components/admin/ResourceAdminCreateForm";
import { ActiveSwitch, ResourceAdminEditForm } from "@shared/components/admin/ResourceAdminEditForm";
import { ResourceAdminTable } from "@shared/components/admin/ResourceAdminTable";
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

export function CredentialTypesPage() {
  const { t } = useTranslation();
  const list = useCredentialTypes();
  const update = useUpdateCredentialType();
  const destroy = useDestroyCredentialType();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<ReferenceRow | null>(null);

  const rows = list.data?.items ?? [];

  const handleToggleActive = (row: ReferenceRow) => {
    update.mutate({ id: row.id, name: row.name, active: row.active === false ? true : false });
  };

  const handleDestroy = async (row: ReferenceRow) => {
    const ok = await confirm({
      title: t("credType.destroy.title", { name: row.name }),
      description: t("credType.destroy.description"),
      confirmLabel: t("credType.destroy.confirm"),
      cancelLabel: t("common.cancel"),
      tone: "destructive",
    });
    if (ok) destroy.mutate(row.id);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title={t("credType.title")} description={t("credType.description")} />

      <Card className="p-0">
        <RoleGate allowed={[Role.ADMIN, Role.SUPER_ADMIN]}>
          <div className="border-b border-gray-50 p-4 sm:p-6">
            <ResourceAdminCreateForm
              resource="credential-types"
              rows={rows}
              submitLabel={t("credType.createAction")}
            />
          </div>
        </RoleGate>

        <ResourceAdminTable
          rows={rows}
          isLoading={list.isLoading}
          isError={list.isError}
          nameLabel={t("credType.column.name")}
          activeLabel={t("credType.column.active")}
          actionsLabel={t("credType.actionsMenu")}
          emptyIcon={Layers}
          emptyTitle={t("credType.empty.title")}
          emptyDescription={t("credType.empty.description")}
          renderActive={(row) => (
            <RoleGate allowed={[Role.ADMIN, Role.SUPER_ADMIN]}>
              <ActiveSwitch
                checked={row.active !== false}
                label={t("credType.activeToggle", { name: row.name })}
                onCheckedChange={() => handleToggleActive(row)}
              />
            </RoleGate>
          )}
          actions={(row) => (
            <RoleGate allowed={[Role.ADMIN, Role.SUPER_ADMIN]}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("credType.actionsMenu")}>
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
                    {t("credType.destroy.menu")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </RoleGate>
          )}
        />
      </Card>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("credType.editTitle")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ResourceAdminEditForm
              name={editing.name}
              active={editing.active !== false}
              showActive
              nameLabel={t("credType.column.name")}
              activeLabel={t("credType.column.active")}
              isPending={update.isPending}
              onSubmit={(values) => {
                update.mutate({
                  id: editing.id,
                  name: values.name,
                  active: values.active,
                });
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
