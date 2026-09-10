import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CalendarClock,
  Clock,
  FileBadge,
  RotateCcw,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { useUser } from "./api/useUser";
import { useLoadMore } from "@shared/hooks/useLoadMore";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { api } from "@shared/api/client";
import type { CredentialDTO, HolderUnitDTO, UserDTO } from "@shared/types/api";
import { BackLink } from "@shared/components/BackLink";
import { PageHeader } from "@shared/components/PageHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { MonoId } from "@shared/components/MonoId";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";
import { MetaDisplay } from "@shared/components/MetaDisplay";
import { DetailRow } from "@shared/components/DetailRow";
import { UserAvatar } from "@shared/components/UserAvatar";
import { UserRoleBadge } from "@shared/components/UserRoleBadge";
import { UserStatusBadge } from "@shared/components/UserStatusBadge";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import { UnitPicker } from "@shared/components/UnitPicker";
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { Button } from "@ui/button";
import { Skeleton } from "@ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select";
import { useConfirm } from "@ui/confirm-dialog";
import { CredentialCard } from "@shared/components/CredentialCard";
import { CredentialStatusFilterMenu } from "@shared/components/CredentialStatusFilterMenu";
import type { CredentialStatusFilter } from "@shared/components/CredentialStatusFilterMenu";
import { CredentialSortMenu } from "@shared/components/CredentialSortMenu";
import { Role, ROLE_LEVEL, canAccessAny, canEditUser, canDeleteUser } from "@shared/auth/role";
import { formatDate, formatDateTime } from "@shared/lib/format";
import { splitMeta, mergeMeta } from "@shared/lib/meta";
import { pathSegments, UNIT_PATH_SEPARATOR } from "@shared/lib/units";
import { MetaEditor } from "@shared/components/MetaEditor";
import { DetailEditForm } from "@shared/components/DetailEditForm";
import type { DetailField } from "@shared/components/DetailEditForm";
import { useUpdateUsers } from "./api/useUpdateUsers";
import { useUpdateUserRoles } from "./api/useUpdateUserRoles";
import { useDeleteUsers } from "./api/useDeleteUsers";
import { useRestoreUsers } from "./api/useRestoreUsers";
import { useUserUnits } from "@shared/api/useUserUnits";
import {
  userDetailEditSchema,
  type UserDetailEditInput,
  type UserUpdateInput,
} from "./schemas/user";
import { useStore } from "@app/store";

const CRED_SORT_OPTIONS = [
  {
    key: "newest",
    getSort: (s: CredentialStatusFilter) => (s === "revoked" ? "-revoked_at" : "-issued_at"),
  },
  {
    key: "oldest",
    getSort: (s: CredentialStatusFilter) => (s === "revoked" ? "revoked_at" : "issued_at"),
  },
  { key: "nameAZ", getSort: () => "name" },
  { key: "nameZA", getSort: () => "-name" },
];

const ROLE_OPTIONS: Role[] = [Role.HOLDER, Role.ISSUER, Role.ADMIN];

function buildDefaults(user: UserDTO): UserDetailEditInput {
  const { entries } = splitMeta(user.meta);
  return {
    name: user.name ?? "",
    number: user.number ?? undefined,
    unit_id: user.unit_id ?? undefined,
    joined_year: user.joined_year ?? undefined,
    birth_date: user.birth_date ? user.birth_date.slice(0, 10) : undefined,
    gender: user.gender ?? null,
    meta_entries: entries,
    email: user.email ?? undefined,
    role:
      user.role === Role.HOLDER || user.role === Role.ISSUER || user.role === Role.ADMIN
        ? user.role
        : undefined,
  };
}

function unitPathLabel(unitId: string | null | undefined, byId: Map<string, HolderUnitDTO>): string {
  if (!unitId) return "—";
  const unit = byId.get(unitId);
  if (!unit) return unitId;
  return pathSegments(unit, byId).join(` ${UNIT_PATH_SEPARATOR} `);
}

export function UserDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading, isError } = useUser(id ?? "");
  const currentUser = useStore((s) => s.user);

  // Credential section state
  const [searchParams, setSearchParams] = useSearchParams();

  const credStatus: CredentialStatusFilter =
    (searchParams.get("credential_status") as CredentialStatusFilter) ?? "all";
  const credSort = searchParams.get("credential_sort") ?? CRED_SORT_OPTIONS[0].getSort(credStatus);

  const isIssuerOrAbove = user ? ROLE_LEVEL[user.role] >= ROLE_LEVEL[Role.ISSUER] : false;

  const searchParam = searchParams.get("credential_search") ?? "";
  const [credSearch, setCredSearch] = useState(searchParam);
  const searchTypedRef = useRef<string | null>(null);
  const debouncedCredSearch = useDebouncedValue(credSearch, 300);

  useEffect(() => {
    if (searchParam !== searchTypedRef.current) {
      searchTypedRef.current = null;
      setCredSearch(searchParam);
    }
  }, [searchParam]);

  const credFilterArray: string[] = (() => {
    const roleField = isIssuerOrAbove ? "issuer_user_id" : "holder_user_id";
    const base = [`${roleField}=${id}`];
    switch (credStatus) {
      case "all":
        return base;
      case "active":
        return [...base, "revoked_at_", "extract_failed_at_"];
      case "revoked":
        return [...base, "revoked_at!_", "extract_failed_at_"];
      case "pending":
        return [...base, "extract_enqueued_at!_", "extracted_at_", "extract_failed_at_"];
      case "failed":
        return [...base, "extract_failed_at!_"];
    }
  })();

  const {
    items: credentials,
    total: credTotal,
    isLoading: credLoading,
    isError: credIsError,
    isFetchingNextPage: credFetchingMore,
    hasMore: credHasMore,
    loadMore: credLoadMore,
    reset: credentialReset,
  } = useLoadMore<CredentialDTO>(
    [
      "user-credentials",
      id,
      { search: debouncedCredSearch || undefined, sort: credSort, filters: credFilterArray },
    ],
    async (page, limit) => {
      const q: Record<string, unknown> = {
        page,
        limit,
        sorts: [credSort],
        includes: ["holder", "issuer", "revoker"],
      };
      if (debouncedCredSearch) q.search = debouncedCredSearch;
      if (credFilterArray.length > 0) q.filters = credFilterArray;
      const response = await api.get("/credentials", { params: q });
      return response.data;
    },
  );

  const handleCredStatusChange = (status: CredentialStatusFilter) => {
    if (status === credStatus) return;
    const newSort = adjustSortForStatus(credSort, credStatus, status);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (status === "all") next.delete("credential_status");
      else next.set("credential_status", status);
      if (newSort === CRED_SORT_OPTIONS[0].getSort(status)) next.delete("credential_sort");
      else next.set("credential_sort", newSort);
      return next;
    });
    credentialReset();
  };

  const handleCredSortChange = (sortString: string) => {
    if (sortString === credSort) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const defaultSort = CRED_SORT_OPTIONS[0].getSort(credStatus);
      if (sortString === defaultSort) next.delete("credential_sort");
      else next.set("credential_sort", sortString);
      return next;
    });
    credentialReset();
  };

  const handleCredSearchChange = (value: string) => {
    setCredSearch(value);
    searchTypedRef.current = value;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value) next.delete("credential_search");
      else next.set("credential_search", value);
      return next;
    });
    credentialReset();
  };

  // ── Edit profile (DetailEditForm) ──────────────────────────────────────
  const update = useUpdateUsers();
  const roleChange = useUpdateUserRoles();
  const deleteUsers = useDeleteUsers();
  const restoreUsers = useRestoreUsers();
  const { confirm, dialog } = useConfirm();
  const { data: units } = useUserUnits();
  const unitsById = useMemo(
    () => new Map((units ?? []).map((u) => [u.id, u])),
    [units],
  );

  const isSelf = !!user && user.id === currentUser?.id;
  const canEdit = !!user && canEditUser(currentUser, user) && !user.deleted_at;
  const canDelete = !!user && !!currentUser && canDeleteUser(currentUser, user) && !user.deleted_at;
  const canRestore = !!user?.deleted_at && canAccessAny(currentUser?.role, [Role.ADMIN, Role.SUPER_ADMIN]);

  const editForm = useForm<UserDetailEditInput>({
    resolver: zodResolver(userDetailEditSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      number: undefined,
      unit_id: undefined,
      joined_year: undefined,
      birth_date: undefined,
      gender: null,
      meta_entries: [],
      email: undefined,
      role: undefined,
    },
  });

  const editUnitId = useWatch({ control: editForm.control, name: "unit_id" });
  const editGender = useWatch({ control: editForm.control, name: "gender" });
  const editRole = useWatch({ control: editForm.control, name: "role" });

  useEffect(() => {
    if (user) editForm.reset(buildDefaults(user));
  }, [user, editForm]);

  const handleSave = async (): Promise<boolean> => {
    if (!user) return false;
    const ok = await editForm.trigger();
    if (!ok) return false;
    const data = editForm.getValues();
    const mergedMeta = mergeMeta(data.meta_entries ?? [], splitMeta(user.meta).preserved);
    const metaChanged = JSON.stringify(mergedMeta) !== JSON.stringify(user.meta ?? null);

    const payload: UserUpdateInput = { id: user.id };
    if (data.name !== user.name && data.name !== undefined && data.name !== "") {
      payload.name = data.name;
    }
    if (
      data.number !== (user.number ?? undefined) &&
      data.number !== undefined &&
      data.number !== ""
    ) {
      payload.number = data.number ?? null;
    }
    if (data.unit_id !== (user.unit_id ?? undefined)) {
      payload.unit_id = data.unit_id ?? undefined;
    }
    if (data.joined_year !== (user.joined_year ?? undefined)) {
      payload.joined_year = Number.isNaN(data.joined_year) ? undefined : data.joined_year;
    }
    if (
      data.birth_date !== (user.birth_date ? user.birth_date.slice(0, 10) : undefined) &&
      data.birth_date !== undefined &&
      data.birth_date !== ""
    ) {
      payload.birth_date = data.birth_date ?? null;
    }
    if (data.gender !== user.gender) {
      payload.gender = data.gender ?? null;
    }
    if (metaChanged) payload.meta = mergedMeta;
    // Email edit is unreachable for self (locked field), but this stays as a
    // belt-and-braces guard right at the 403 boundary (user_policy.go:69-72).
    if (data.email && data.email !== user.email && !isSelf) {
      payload.email = data.email;
    }

    const profileChanged = Object.keys(payload).length > 1;
    const roleChanged = !!data.role && data.role !== user.role;
    if (!profileChanged && !roleChanged) return true;

    if (roleChanged) {
      const confirmed = await confirm({
        title: t("user.role.confirm.title", { role: t(`user.edit.role.${data.role}`) }),
        description: t("user.role.confirm.body"),
        confirmLabel: t("user.role.confirm.action"),
        cancelLabel: t("common.cancel"),
      });
      if (!confirmed) return false;
    }

    try {
      if (profileChanged) await update.mutateAsync({ users: [payload] });
      if (roleChanged) {
        await roleChange.mutateAsync({
          user_roles: [{ user_id: user.id, role: data.role as Role }],
        });
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleCancelEdit = () => {
    if (user) editForm.reset(buildDefaults(user));
  };

  const handleDelete = async () => {
    if (!user) return;
    const confirmed = await confirm({
      title: t("user.delete.confirm.title", { name: user.name ?? user.email }),
      description: t("user.delete.confirm.body"),
      confirmLabel: t("user.delete.confirm.action"),
      cancelLabel: t("common.cancel"),
      tone: "destructive",
    });
    if (confirmed) deleteUsers.mutate([user.id]);
  };

  const handleRestore = async () => {
    if (!user) return;
    const confirmed = await confirm({
      title: t("user.restore.confirm.title", { name: user.name ?? user.email }),
      description: t("user.restore.confirm.body"),
      confirmLabel: t("user.restore.confirm.action"),
      cancelLabel: t("common.cancel"),
    });
    if (confirmed) restoreUsers.mutate([user.id]);
  };

  const editFields: DetailField[] = user
    ? [
        {
          key: "name",
          label: t("user.edit.fullName"),
          readValue: user.name ?? "—",
          editControl: (
            <Input aria-label={t("user.edit.fullName")} {...editForm.register("name")} />
          ),
          error: editForm.formState.errors.name?.message,
        },
        {
          key: "email",
          label: t("user.detail.email"),
          readValue: user.email,
          editControl: (
            <Input
              type="email"
              aria-label={t("user.detail.email")}
              {...editForm.register("email")}
            />
          ),
          error: editForm.formState.errors.email?.message,
          lockedReason: isSelf ? t("user.edit.superAdmin.emailLocked") : undefined,
        },
        {
          key: "number",
          label: t("user.edit.numberId"),
          readValue: user.number ?? "—",
          editControl: (
            <Input aria-label={t("user.edit.numberId")} {...editForm.register("number")} />
          ),
          error: editForm.formState.errors.number?.message,
        },
        {
          key: "unit_id",
          label: t("user.field.unit"),
          readValue: unitPathLabel(user.unit_id, unitsById),
          editControl: (
            <UnitPicker
              value={editUnitId}
              onChange={(value) =>
                editForm.setValue("unit_id", value ?? null, { shouldValidate: true })
              }
              label={t("user.field.unit")}
            />
          ),
          error: editForm.formState.errors.unit_id?.message,
        },
        {
          key: "joined_year",
          label: t("user.field.joinedYear"),
          readValue: user.joined_year ?? "—",
          editControl: (
            <Input
              type="number"
              aria-label={t("user.field.joinedYear")}
              {...editForm.register("joined_year", { valueAsNumber: true })}
            />
          ),
          error: editForm.formState.errors.joined_year?.message,
        },
        {
          key: "birth_date",
          label: t("user.edit.birthDate"),
          readValue: user.birth_date ? formatDate(user.birth_date) : "—",
          editControl: (
            <Input
              type="date"
              aria-label={t("user.edit.birthDate")}
              {...editForm.register("birth_date")}
            />
          ),
          error: editForm.formState.errors.birth_date?.message,
        },
        {
          key: "gender",
          label: t("user.field.gender"),
          readValue: user.gender ? t(`user.field.gender.${user.gender}`) : "—",
          editControl: (
            <Select
              value={editGender ?? "__none__"}
              onValueChange={(value) =>
                editForm.setValue(
                  "gender",
                  value === "__none__" ? null : (value as "male" | "female"),
                  {
                    shouldValidate: true,
                  },
                )
              }
            >
              <SelectTrigger aria-label={t("user.field.gender")}>
                <SelectValue placeholder={t("user.field.gender.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("common.notSet")}</SelectItem>
                <SelectItem value="male">{t("user.field.gender.male")}</SelectItem>
                <SelectItem value="female">{t("user.field.gender.female")}</SelectItem>
              </SelectContent>
            </Select>
          ),
          error: editForm.formState.errors.gender?.message,
        },
        {
          key: "role",
          label: t("user.edit.role"),
          readValue: <UserRoleBadge role={user.role} />,
          editControl: (
            <Select
              value={editRole ?? "__none__"}
              onValueChange={(value) => {
                if (ROLE_OPTIONS.includes(value as Role)) {
                  editForm.setValue("role", value as UserDetailEditInput["role"], {
                    shouldValidate: true,
                  });
                }
              }}
            >
              <SelectTrigger aria-label={t("user.edit.role")}>
                <SelectValue placeholder={t("user.edit.role.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`user.edit.role.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ),
          error: editForm.formState.errors.role?.message,
          lockedReason:
            isSelf || user.role === Role.SUPER_ADMIN
              ? t("user.edit.superAdmin.roleLocked")
              : undefined,
        },
        {
          key: "meta_entries",
          label: t("meta.label"),
          readValue:
            user.meta && Object.keys(user.meta).length > 0 ? <MetaDisplay meta={user.meta} /> : "—",
          editControl: <MetaEditor control={editForm.control} />,
          error: editForm.formState.errors.meta_entries?.message,
          fullWidth: true,
        },
      ]
    : [];

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <BackLink />
        <PageHeader title={t("user.detail.title")} />
        <EmptyState
          icon={AlertCircle}
          title={t("user.detail.notFound.title")}
          description={t("user.detail.notFound.body")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink />
      <PageHeader title={user?.name ?? t("user.detail.title")} />

      {isLoading || !user ? (
        <Card className="space-y-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-6 sm:p-8">
          {/* Header: avatar + name + badges + actions */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <UserAvatar user={user} size="xl" />
              <div>
                <h3 className="font-display text-xl font-bold text-navy">
                  {user.name ?? t("user.detail.unnamed")}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <UserRoleBadge role={user.role} />
                <UserStatusBadge deletedAt={user.deleted_at} />
              </div>
              {(canDelete || canRestore) && (
                <div className="flex items-center gap-2">
                  {canDelete && (
                    <Button variant="destructive" size="sm" onClick={() => void handleDelete()}>
                      <Trash2 className="h-4 w-4" />
                      {t("user.actions.delete")}
                    </Button>
                  )}
                  {canRestore && (
                    <Button variant="outline" size="sm" onClick={() => void handleRestore()}>
                      <RotateCcw className="h-4 w-4" />
                      {t("user.actions.restore")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <hr className="my-6 border-gray-100" />

          <DetailEditForm
            title={t("user.detail.identity")}
            fields={editFields}
            canEdit={canEdit}
            editDisabledReason={
              user.deleted_at
                ? t("user.edit.trashed.body", { name: user.name ?? user.email })
                : undefined
            }
            onSave={handleSave}
            onCancel={handleCancelEdit}
            isSaving={update.isPending || roleChange.isPending}
            className="mt-2"
          />

          <div className="mt-6 border-t border-gray-100 pt-6">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailRow
                icon={Wallet}
                label={t("user.detail.walletAddress")}
                value={
                  <div className="flex items-center gap-1">
                    <MonoId
                      value={user.wallet_address}
                      mode="address"
                      className="text-sm text-navy"
                    />
                    <CopyInlineButton
                      value={user.wallet_address}
                      ariaLabel={t("cred.copy.userWallet")}
                      className="shrink-0"
                    />
                  </div>
                }
              />
              <DetailRow
                icon={Clock}
                label={t("user.detail.created")}
                value={formatDateTime(user.created_at)}
              />
              <DetailRow
                icon={CalendarClock}
                label={t("user.detail.updated")}
                value={formatDateTime(user.updated_at)}
              />
              {user.deleted_at && (
                <DetailRow
                  icon={Trash2}
                  label={t("user.detail.deleted")}
                  value={formatDateTime(user.deleted_at)}
                  tone="error"
                />
              )}
            </dl>
          </div>
        </Card>
      )}

      {/* Credentials section */}
      <Card className="p-0">
        <div className="border-b border-gray-50 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <EyebrowLabel>
              {t(
                isIssuerOrAbove
                  ? "user.detail.credentialSectionIssued"
                  : "user.detail.credentialSectionHeld",
              )}
              {credTotal > 0 && <span className="ml-2 text-xs text-gray-400">({credTotal})</span>}
            </EyebrowLabel>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="w-full md:max-w-md md:flex-1">
              <Input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                leadingIcon={Search}
                placeholder={t("cred.list.searchPlaceholder")}
                value={credSearch}
                onChange={(e) => handleCredSearchChange(e.target.value)}
                aria-label={t("cred.list.searchAriaLabel")}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 md:ml-auto md:shrink-0">
              <CredentialStatusFilterMenu value={credStatus} onChange={handleCredStatusChange} />
              <CredentialSortMenu
                value={credSort}
                onChange={handleCredSortChange}
                statusFilter={credStatus}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-50/30 p-4 sm:p-6">
          {credIsError ? (
            <div className="p-12 text-center text-sm text-error">
              {t(
                isIssuerOrAbove
                  ? "user.detail.credentials.errorIssued"
                  : "user.detail.credentials.errorHeld",
              )}
            </div>
          ) : credLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : credentials.length === 0 ? (
            <EmptyState
              icon={FileBadge}
              title={t(
                isIssuerOrAbove
                  ? "user.detail.credentials.emptyIssued.title"
                  : "user.detail.credentials.emptyHeld.title",
              )}
              description={t(
                isIssuerOrAbove
                  ? "user.detail.credentials.emptyIssued.body"
                  : "user.detail.credentials.emptyHeld.body",
              )}
              className="rounded-none border-0 bg-transparent shadow-none"
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {credentials.map((cred) => (
                <CredentialCard key={cred.id} credential={cred} showActor={!isIssuerOrAbove} />
              ))}
            </div>
          )}
        </div>

        {credTotal > 0 && (
          <LoadMoreBar
            total={credTotal}
            hasMore={credHasMore}
            isLoading={credFetchingMore}
            onLoadMore={credLoadMore}
            countLabel={t("cred.list.count", { count: credentials.length, total: credTotal })}
          />
        )}
      </Card>

      {dialog}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function adjustSortForStatus(
  sortString: string,
  oldStatus: CredentialStatusFilter,
  newStatus: CredentialStatusFilter,
): string {
  for (const opt of CRED_SORT_OPTIONS) {
    if (opt.getSort(oldStatus) === sortString) {
      return opt.getSort(newStatus);
    }
  }
  return sortString;
}
