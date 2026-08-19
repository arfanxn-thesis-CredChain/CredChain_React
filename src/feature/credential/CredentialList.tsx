import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Ban, FileBadge, RefreshCw, Search, ShieldCheck, Upload } from "lucide-react";
import { useRevokeCredentials } from "./api/useRevokeCredentials";
import { useReExtractCredentials } from "./api/useReExtractCredentials";
import { useStore } from "@app/store";
import { Role, canAccessAny } from "@shared/auth/role";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { useLoadMore } from "@shared/hooks/useLoadMore";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import type { CredentialDTO } from "@shared/types/api";

import { PageHeader } from "@shared/components/PageHeader";
import { EmptyState } from "@shared/components/EmptyState";

import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { Skeleton } from "@ui/skeleton";
import { useConfirm } from "@ui/confirm-dialog";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";

import { CredentialCard } from "@shared/components/CredentialCard";
import { CredentialStatusFilterMenu } from "@shared/components/CredentialStatusFilterMenu";
import type { CredentialStatusFilter } from "@shared/components/CredentialStatusFilterMenu";
import { CredentialSortMenu } from "@shared/components/CredentialSortMenu";
import { CredentialLifecycleStatusBadge } from "./components/CredentialLifecycleStatusBadge";

const MAX_SELECTION = 100;

const SORT_OPTIONS = [
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

type BulkMode = "revoke" | "reextract" | null;

function adjustSortForStatus(
  sortString: string,
  oldStatus: CredentialStatusFilter,
  newStatus: CredentialStatusFilter,
): string {
  for (const opt of SORT_OPTIONS) {
    if (opt.getSort(oldStatus) === sortString) {
      return opt.getSort(newStatus);
    }
  }
  return sortString;
}

export function CredentialList() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<BulkMode>(null);

  const credStatus: CredentialStatusFilter =
    (searchParams.get("status") as CredentialStatusFilter) ?? "active";
  const credSort = searchParams.get("sort") ?? SORT_OPTIONS[0].getSort(credStatus);

  const searchParam = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(searchParam);
  const searchTypedRef = useRef<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (searchParam !== searchTypedRef.current) {
      searchTypedRef.current = null;
      setSearch(searchParam);
    }
  }, [searchParam]);

  const currentUser = useStore((s) => s.user);
  const canManage = canAccessAny(currentUser?.role, [Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN]);
  const isHolder = currentUser?.role === Role.HOLDER;

  const filterArray: string[] = (() => {
    switch (credStatus) {
      case "all":
        return [];
      case "active":
        return ["revoked_at_", "extract_status!=failed"];
      case "revoked":
        return ["revoked_at!_", "extract_status!=failed"];
      case "pending":
        return ["extract_status=pending"];
      case "failed":
        return ["extract_status=failed"];
    }
  })();

  const {
    items: credentials,
    total,
    isLoading,
    isError,
    isFetchingNextPage,
    hasMore,
    loadMore,
    reset,
  } = useLoadMore<CredentialDTO>(
    [
      isHolder ? "my-credentials" : "credentials",
      { search: debouncedSearch || undefined, sort: credSort, filters: filterArray },
    ],
    async (page, limit) => {
      const q: Record<string, unknown> = {};
      q.page = page;
      q.limit = limit;
      if (debouncedSearch) q.search = debouncedSearch;
      q.sorts = [credSort];
      if (filterArray.length > 0) q.filters = filterArray;
      q.includes = ["holder", "issuer", "revoker"];
      const endpoint = isHolder ? "/users/self/credentials" : "/credentials";
      const response = await api.get(endpoint, { params: q });
      return response.data;
    },
  );

  const isEmpty = !isLoading && credentials.length === 0;
  const selectionFull = selectedIds.size >= MAX_SELECTION;

  const revoke = useRevokeCredentials();
  const reExtract = useReExtractCredentials();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const isRevokable = (cred: CredentialDTO) => cred.revoked_at === null;
  const isReExtractable = (cred: CredentialDTO) => cred.extract_status === "failed";

  const eligibleRevokeIds = Array.from(selectedIds).filter((id) =>
    credentials.some((c) => c.id === id && isRevokable(c)),
  );
  const eligibleReExtractIds = Array.from(selectedIds).filter((id) =>
    credentials.some((c) => c.id === id && isReExtractable(c)),
  );

  const enterMode = (mode: BulkMode) => {
    setBulkMode(mode);
    setSelectedIds(new Set());
  };

  const exitMode = () => {
    setBulkMode(null);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= MAX_SELECTION) {
        notify.warning("cred.card.selectionCapReached");
        return;
      }
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkRevoke = async () => {
    if (eligibleRevokeIds.length === 0) return;
    const ok = await confirm({
      title: t("cred.revoke.confirmTitle", { count: eligibleRevokeIds.length }),
      description: t("cred.revoke.confirmBody"),
      confirmLabel: t("cred.revoke.confirmAction"),
      tone: "destructive",
    });
    if (!ok) return;
    revoke.mutate(eligibleRevokeIds, { onSuccess: () => exitMode() });
  };

  const handleBulkReExtract = async () => {
    if (eligibleReExtractIds.length === 0) return;
    const ok = await confirm({
      title: t("cred.reextract.confirmTitle", { count: eligibleReExtractIds.length }),
      description: t("cred.reextract.confirmBody"),
      confirmLabel: t("cred.reextract.confirmAction"),
    });
    if (!ok) return;
    reExtract.mutate(eligibleReExtractIds, { onSuccess: () => exitMode() });
  };

  const renderActions = () => {
    if (!canManage) {
      return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {isHolder && (
            <Button asChild variant="gold">
              <Link to="/credentials/submit">
                <Upload className="h-4 w-4" />
                {t("cred.list.submitCta")}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/credentials/verify">
              <ShieldCheck className="h-4 w-4" />
              {t("cred.list.verifyCta")}
            </Link>
          </Button>
        </div>
      );
    }

    if (bulkMode === "revoke") {
      return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="outline" onClick={exitMode} disabled={revoke.isPending}>
            {t("cred.card.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleBulkRevoke}
            disabled={eligibleRevokeIds.length === 0 || revoke.isPending}
          >
            <Ban className="h-4 w-4" />
            {t("cred.card.revokeSelectedCount", { count: eligibleRevokeIds.length })}
          </Button>
        </div>
      );
    }

    if (bulkMode === "reextract") {
      return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="outline" onClick={exitMode} disabled={reExtract.isPending}>
            {t("cred.card.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleBulkReExtract}
            disabled={eligibleReExtractIds.length === 0 || reExtract.isPending}
          >
            <RefreshCw className="h-4 w-4" />
            {t("cred.card.reExtractSelectedCount", { count: eligibleReExtractIds.length })}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <Button variant="outline" onClick={() => enterMode("revoke")}>
          <Ban className="h-4 w-4" />
          {t("cred.card.revokeMode")}
        </Button>
        <Button variant="outline" onClick={() => enterMode("reextract")}>
          <RefreshCw className="h-4 w-4" />
          {t("cred.card.reExtractMode")}
        </Button>
        <Button asChild variant="outline">
          <Link to="/credentials/verify">
            <ShieldCheck className="h-4 w-4" />
            {t("cred.list.verifyCta")}
          </Link>
        </Button>
        <Button asChild variant="gold" className="w-full sm:w-auto">
          <Link to="/credentials/issue">
            <FileBadge className="h-4 w-4" />
            {t("cred.list.issueCta")}
          </Link>
        </Button>
      </div>
    );
  };

  const handleStatusChange = (status: CredentialStatusFilter) => {
    if (status === credStatus) return;
    const newSort = adjustSortForStatus(credSort, credStatus, status);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (status === "active") next.delete("status");
      else next.set("status", status);
      if (newSort === SORT_OPTIONS[0].getSort(status)) next.delete("sort");
      else next.set("sort", newSort);
      return next;
    });
    reset();
  };

  const handleSortChange = (sortString: string) => {
    if (sortString === credSort) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const defaultSort = SORT_OPTIONS[0].getSort(credStatus);
      if (sortString === defaultSort) next.delete("sort");
      else next.set("sort", sortString);
      return next;
    });
    reset();
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    searchTypedRef.current = value;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value) next.delete("search");
      else next.set("search", value);
      return next;
    });
    reset();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={t("cred.list.title")}
        description={t("cred.list.description")}
        action={renderActions()}
      />

      <Card className="p-0">
        <div className="border-b border-gray-50 p-4 sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="w-full md:max-w-md md:flex-1">
              <Input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                leadingIcon={Search}
                placeholder={t("cred.list.searchPlaceholder")}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                aria-label={t("cred.list.searchAriaLabel")}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 md:ml-auto md:shrink-0">
              <CredentialStatusFilterMenu value={credStatus} onChange={handleStatusChange} />
              <CredentialSortMenu
                value={credSort}
                onChange={handleSortChange}
                statusFilter={credStatus}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-50/30 p-4 sm:p-6">
          {isError ? (
            <div className="p-12 text-center text-sm text-error">{t("cred.list.error")}</div>
          ) : isEmpty ? (
            <EmptyState
              icon={FileBadge}
              title={
                debouncedSearch
                  ? t("cred.list.empty.search.title")
                  : t("cred.list.empty.none.title")
              }
              description={
                debouncedSearch ? t("cred.list.empty.search.body") : t("cred.list.empty.none.body")
              }
              className="rounded-none border-0 bg-transparent shadow-none"
            />
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {credentials.map((cred) => {
                const isSelectable =
                  bulkMode === "revoke"
                    ? isRevokable(cred)
                    : bulkMode === "reextract"
                      ? isReExtractable(cred)
                      : false;
                return (
                  <CredentialCard
                    key={cred.id}
                    credential={cred}
                    statusBadge={<CredentialLifecycleStatusBadge status={cred.lifecycle_status} />}
                    selectionMode={canManage ? bulkMode : undefined}
                    isSelected={canManage ? selectedIds.has(cred.id) : undefined}
                    onSelect={canManage ? () => toggleSelection(cred.id) : undefined}
                    selectDisabled={
                      canManage && bulkMode
                        ? !isSelectable || (selectionFull && !selectedIds.has(cred.id))
                        : undefined
                    }
                    blockLinks={!canManage}
                  />
                );
              })}
            </div>
          )}
        </div>

        {total > 0 && (
          <LoadMoreBar
            total={total}
            hasMore={hasMore}
            isLoading={isFetchingNextPage}
            onLoadMore={loadMore}
            countLabel={t("cred.list.count", { count: credentials.length, total })}
          />
        )}
      </Card>

      {confirmDialog}
    </div>
  );
}
