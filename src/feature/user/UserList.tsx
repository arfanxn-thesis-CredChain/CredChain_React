import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  UserCircle,
  MoreVertical,
  Eye,
  ArrowRightLeft,
  Trash2,
  RotateCcw,
  Calendar,
  CalendarClock,
  ListTree,
  Mail,
  Hash,
  Wallet,
  VenusAndMars,
  Building2,
} from "lucide-react";
import { useLoadMore } from "@shared/hooks/useLoadMore";
import { api } from "@shared/api/client";
import { useTransferSuperAdmin } from "./api/useTransferSuperAdmin";
import { useDeleteUsers } from "./api/useDeleteUsers";
import { useRestoreUsers } from "./api/useRestoreUsers";
import { useStore } from "@app/store";
import { Role, canAccessAny, canDeleteUser, canTransferTo } from "@shared/auth/role";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { useUserListParams } from "./hooks/useUserListParams";
import { cn } from "@shared/lib/cn";
import { useConfirm } from "@ui/confirm-dialog";
import type { UserDTO } from "@shared/types/api";

import { PageHeader } from "@shared/components/PageHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { RoleGate } from "@shared/auth/guards";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { Skeleton } from "@ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";

import { SortMenu } from "./components/SortMenu";
import { RoleFilterMenu } from "./components/RoleFilterMenu";
import { StatusFilterMenu } from "./components/StatusFilterMenu";
import { HolderUnitFilterMenu } from "./components/HolderUnitFilterMenu";
import { useUserUnits } from "./api/useUserUnits";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";
import { UserAvatar } from "@shared/components/UserAvatar";
import { UserRoleBadge } from "@shared/components/UserRoleBadge";
import { UserStatusBadge } from "@shared/components/UserStatusBadge";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { relativeTime, truncateAddress } from "@shared/lib/format";

export function UserList() {
  const { t, i18n } = useTranslation();
  const { params, setParam } = useUserListParams();
  const [inputValue, setInputValue] = useState(params.search);
  const searchTypedRef = useRef<string | null>(null);
  const debouncedSearch = useDebouncedValue(inputValue, 300);

  useEffect(() => {
    if (params.search !== searchTypedRef.current) {
      searchTypedRef.current = null;
      setInputValue(params.search);
    }
  }, [params.search]);
  const transfer = useTransferSuperAdmin();
  const deleteUsers = useDeleteUsers();
  const restoreUsers = useRestoreUsers();
  const { confirm, dialog } = useConfirm();

  const currentUser = useStore((s) => s.user);
  const canManageUsers = canAccessAny(currentUser?.role, [Role.ADMIN, Role.SUPER_ADMIN]);
  const navigate = useNavigate();

  const { data: units } = useUserUnits();
  const unitNames = useMemo(() => new Map((units ?? []).map((u) => [u.id, u.name])), [units]);

  const sortArray = params.sort ? [params.sort] : ["-updated_at"];
  const filterArray: string[] = [];
  if (params.role !== "all") filterArray.push(`role=${params.role}`);
  if (params.unit) filterArray.push(`unit_id=${params.unit}`);
  if (params.status === "deleted_at!_") filterArray.push("deleted_at!_");
  else if (params.status === "deleted_at_") filterArray.push("deleted_at_");

  const {
    items: users,
    total,
    isLoading,
    isError,
    isFetchingNextPage,
    hasMore,
    loadMore,
  } = useLoadMore<UserDTO>(
    ["users", { search: debouncedSearch || undefined, sorts: sortArray, filters: filterArray }],
    async (page, limit) => {
      const q: Record<string, unknown> = {};
      q.page = page;
      q.limit = limit;
      if (debouncedSearch) q.search = debouncedSearch;
      q.sorts = sortArray;
      if (filterArray.length > 0) q.filters = filterArray;
      const response = await api.get("/users", { params: q });
      return response.data;
    },
  );

  const isEmpty = !isLoading && users.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={t("user.list.title")}
        description={t("user.list.description")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/user-units">
                <ListTree className="h-5 w-5" />
                {canManageUsers ? t("user.units.manage") : t("user.units.view")}
              </Link>
            </Button>
            <RoleGate allowed={[Role.ADMIN, Role.SUPER_ADMIN]}>
              <Button asChild variant="gold">
                <Link to="/users/create">
                  <Plus className="h-5 w-5" />
                  {t("user.list.registerCta")}
                </Link>
              </Button>
            </RoleGate>
          </div>
        }
      />

      <Card className="p-0">
        <div className="border-b border-gray-50 p-4 sm:p-6">
          <div className="space-y-3">
            <div className="w-full md:max-w-2xl">
              <Input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                leadingIcon={Search}
                placeholder={t("user.list.searchPlaceholder")}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  searchTypedRef.current = e.target.value;
                  setParam("search", e.target.value);
                }}
                aria-label={t("user.list.searchPlaceholder")}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HolderUnitFilterMenu value={params.unit} onChange={(v) => setParam("unit", v)} />
              <RoleFilterMenu value={params.role} onChange={(r) => setParam("role", r)} />
              <StatusFilterMenu value={params.status} onChange={(v) => setParam("status", v)} />
              <SortMenu
                value={params.sort}
                onChange={(sortString) => setParam("sort", sortString)}
              />
            </div>
          </div>
        </div>

        {isError ? (
          <div className="p-12 text-center text-sm text-error">{t("user.list.error")}</div>
        ) : isEmpty ? (
          <EmptyState
            icon={UserCircle}
            title={
              debouncedSearch ? t("user.list.empty.search.title") : t("user.list.empty.none.title")
            }
            description={
              debouncedSearch ? t("user.list.empty.search.body") : t("user.list.empty.none.body")
            }
            className="rounded-none border-0 shadow-none"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("user.column.entity")}</TableHead>
                    <TableHead className="relative">
                      <span className="sr-only">{t("user.column.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                              <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-40" />
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-36" />
                                <Skeleton className="h-3 w-28" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Skeleton className="ml-auto h-4 w-16" />
                          </TableCell>
                        </TableRow>
                      ))
                    : users.map((user) => (
                        <TableRow
                          key={user.id}
                          className={cn("cursor-pointer", user.deleted_at && "bg-error/5")}
                          onClick={() => navigate(`/users/${user.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.defaultPrevented) {
                              navigate(`/users/${user.id}`);
                            }
                          }}
                        >
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <UserAvatar user={user} size="sm" className="mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link
                                    to={`/users/${user.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn(
                                      "line-clamp-1 text-sm font-bold text-navy hover:underline focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                                      user.deleted_at && "text-gray-400 line-through",
                                    )}
                                  >
                                    {user.name ?? user.email}
                                  </Link>
                                  <UserRoleBadge role={user.role} />
                                  <UserStatusBadge deletedAt={user.deleted_at} />
                                </div>
                                <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-gray-500 sm:grid-cols-2 lg:grid-cols-3">
                                  {user.unit_id && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setParam("unit", user.unit_id ?? "");
                                      }}
                                      aria-label={t("user.filter.unit")}
                                      title={t("user.filter.unit")}
                                      className="flex cursor-pointer items-center gap-1 text-left hover:text-navy sm:col-span-2 lg:col-span-3"
                                    >
                                      <Building2
                                        className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                        aria-hidden="true"
                                      />
                                      <span className="truncate">
                                        {unitNames.get(user.unit_id) ?? "—"}
                                      </span>
                                    </button>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Hash
                                      className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                      aria-hidden="true"
                                    />
                                    <span className="truncate" title={user.number ?? undefined}>
                                      {user.number ?? "—"}
                                    </span>
                                    {user.number && (
                                      <CopyInlineButton
                                        value={user.number}
                                        ariaLabel={t("user.copy.number")}
                                        className="shrink-0"
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Mail
                                      className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                      aria-hidden="true"
                                    />
                                    <span className="truncate" title={user.email}>
                                      {user.email}
                                    </span>
                                    <CopyInlineButton
                                      value={user.email}
                                      ariaLabel={t("user.copy.email")}
                                      className="shrink-0"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 font-mono">
                                    <Wallet
                                      className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                      aria-hidden="true"
                                    />
                                    <span
                                      className="truncate"
                                      title={user.wallet_address ?? undefined}
                                    >
                                      {user.wallet_address
                                        ? truncateAddress(user.wallet_address)
                                        : "—"}
                                    </span>
                                    {user.wallet_address && (
                                      <CopyInlineButton
                                        value={user.wallet_address}
                                        ariaLabel={t("user.copy.wallet")}
                                        className="shrink-0"
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <VenusAndMars
                                      className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      {user.gender ? t(`user.field.gender.${user.gender}`) : "—"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <CalendarClock
                                      className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      {t("user.list.joinedInline", {
                                        year: user.joined_year ?? "—",
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar
                                      className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      {user.deleted_at
                                        ? t("user.list.trashed", {
                                            time: relativeTime(user.deleted_at, i18n.language),
                                          })
                                        : user.updated_at !== user.created_at
                                          ? t("user.list.updated", {
                                              time: relativeTime(user.updated_at, i18n.language),
                                            })
                                          : t("user.list.created", {
                                              time: relativeTime(user.created_at, i18n.language),
                                            })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t("user.actions.menu")}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/users/${user.id}`);
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  {t("common.view")}
                                </DropdownMenuItem>
                                {currentUser && canTransferTo(currentUser, user) && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void (async () => {
                                        const ok = await confirm({
                                          title: t("user.transfer.confirm.title", {
                                            name: user.name ?? user.email,
                                          }),
                                          description: t("user.transfer.confirm.body", {
                                            name: user.name ?? user.email,
                                          }),
                                          confirmLabel: t("user.transfer.confirm.action"),
                                          cancelLabel: t("common.cancel"),
                                          tone: "destructive",
                                        });
                                        if (ok) transfer.mutate(user.id);
                                      })();
                                    }}
                                  >
                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                    {t("user.transfer.menuLabel")}
                                  </DropdownMenuItem>
                                )}
                                {currentUser &&
                                  canDeleteUser(currentUser, user) &&
                                  !user.deleted_at && (
                                    <DropdownMenuItem
                                      destructive
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void (async () => {
                                          const ok = await confirm({
                                            title: t("user.delete.confirm.title", {
                                              name: user.name ?? user.email,
                                            }),
                                            description: t("user.delete.confirm.body"),
                                            confirmLabel: t("user.delete.confirm.action"),
                                            cancelLabel: t("common.cancel"),
                                            tone: "destructive",
                                          });
                                          if (ok) deleteUsers.mutate([user.id]);
                                        })();
                                      }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      {t("user.actions.delete")}
                                    </DropdownMenuItem>
                                  )}
                                {canManageUsers && user.deleted_at && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void (async () => {
                                        const ok = await confirm({
                                          title: t("user.restore.confirm.title", {
                                            name: user.name ?? user.email,
                                          }),
                                          description: t("user.restore.confirm.body"),
                                          confirmLabel: t("user.restore.confirm.action"),
                                          cancelLabel: t("common.cancel"),
                                        });
                                        if (ok) restoreUsers.mutate([user.id]);
                                      })();
                                    }}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    {t("user.actions.restore")}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>

            {total > 0 && (
              <LoadMoreBar
                total={total}
                hasMore={hasMore}
                isLoading={isFetchingNextPage}
                onLoadMore={loadMore}
                countLabel={t("user.list.footerCount", { count: users.length, total })}
              />
            )}
          </>
        )}
      </Card>

      {dialog}

      {!canManageUsers && (
        <p className="text-center text-xs text-gray-400">{t("user.list.roleAdminNotice")}</p>
      )}
    </div>
  );
}
