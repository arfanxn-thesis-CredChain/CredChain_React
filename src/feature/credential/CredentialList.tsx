import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  FileBadge,
  Library,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { useRevokeCredentials } from "./api/useRevokeCredentials";
import { useReExtractCredentials } from "./api/useReExtractCredentials";
import { useApproveCredentials } from "./api/useApproveCredentials";
import { useRejectCredentials } from "./api/useRejectCredentials";
import { CredentialRejectReasonModal } from "./components/CredentialRejectReasonModal";
import { useStore } from "@app/store";
import { useUserUnits } from "@shared/api/useUserUnits";
import { Role, canAccessAny } from "@shared/auth/role";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { useLoadMore } from "@shared/hooks/useLoadMore";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isEligibleFor, type BulkMode } from "@shared/lib/credentialEligibility";
import type { CredentialDTO, PaginatedResponse } from "@shared/types/api";

import { PageHeader } from "@shared/components/PageHeader";
import { EmptyState } from "@shared/components/EmptyState";

import { Button } from "@ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { Skeleton } from "@ui/skeleton";
import { useConfirm } from "@ui/confirm-dialog";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";

import { CredentialCard } from "@shared/components/CredentialCard";
import { CredentialSortMenu } from "@shared/components/CredentialSortMenu";
import { CredentialStatusMenu } from "./components/CredentialStatusMenu";
import type {
  CredentialExtractFilter,
  CredentialReviewStatus,
} from "./components/CredentialStatusMenu";
import { CredentialTypeFilterMenu } from "./components/CredentialTypeFilterMenu";
import { CredentialOrganizationFilterMenu } from "./components/CredentialOrganizationFilterMenu";
import { CredentialCompetencyFilterMenu } from "./components/CredentialCompetencyFilterMenu";
import { HolderUnitFilterMenu } from "./components/HolderUnitFilterMenu";

const MAX_SELECTION = 100;

const REVIEW_FILTERS: Record<CredentialReviewStatus, string[]> = {
  all: [],
  pending: ["approved_at_", "rejected_at_"],
  approved: ["approved_at!_"],
  rejected: ["rejected_at!_"],
  revoked: ["revoked_at!_"],
};

const EXTRACT_FILTERS: Record<CredentialExtractFilter, string[]> = {
  any: [],
  unextracted: ["extract_enqueued_at_"],
  pending: ["extract_enqueued_at!_", "extracted_at_", "extract_failed_at_"],
  succeeded: ["extracted_at!_", "extract_failed_at_"],
  failed: ["extract_failed_at!_"],
};

const SORT_OPTIONS = [
  {
    key: "newest",
    getSort: (r: CredentialReviewStatus) => (r === "revoked" ? "-revoked_at" : "-issued_at"),
  },
  {
    key: "oldest",
    getSort: (r: CredentialReviewStatus) => (r === "revoked" ? "revoked_at" : "issued_at"),
  },
  { key: "nameAZ", getSort: () => "name" },
  { key: "nameZA", getSort: () => "-name" },
];

function adjustSortForStatus(
  sortString: string,
  oldReview: CredentialReviewStatus,
  newReview: CredentialReviewStatus,
): string {
  for (const opt of SORT_OPTIONS) {
    if (opt.getSort(oldReview) === sortString) {
      return opt.getSort(newReview);
    }
  }
  return sortString;
}

const REVIEW_VALUES: CredentialReviewStatus[] = [
  "all",
  "pending",
  "approved",
  "rejected",
  "revoked",
];
const EXTRACT_VALUES: CredentialExtractFilter[] = [
  "any",
  "unextracted",
  "pending",
  "succeeded",
  "failed",
];

function isReviewStatus(value: string | null): value is CredentialReviewStatus {
  return value !== null && (REVIEW_VALUES as string[]).includes(value);
}

function isExtractFilter(value: string | null): value is CredentialExtractFilter {
  return value !== null && (EXTRACT_VALUES as string[]).includes(value);
}

export function CredentialList() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<BulkMode>(null);

  const reviewParam = searchParams.get("review");
  const extractParam = searchParams.get("extract");
  const review: CredentialReviewStatus = isReviewStatus(reviewParam) ? reviewParam : "all";
  const extract: CredentialExtractFilter = isExtractFilter(extractParam) ? extractParam : "any";
  const credSort = searchParams.get("sort") ?? SORT_OPTIONS[0].getSort(review);

  const typeId = searchParams.get("type_id");
  const orgId = searchParams.get("org_id");
  const competencyId = searchParams.get("competency_id");
  const unitId = searchParams.get("unit_id");

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

  const filterArray: string[] = [
    ...REVIEW_FILTERS[review],
    ...EXTRACT_FILTERS[extract],
    ...(typeId ? [`type_id=${typeId}`] : []),
    ...(orgId ? [`issuer_organization_id=${orgId}`] : []),
    ...(competencyId ? [`competency_id=${competencyId}`] : []),
    ...(unitId ? [`holder_unit_id=${unitId}`] : []),
  ];

  const pendingCountQuery = useQuery({
    queryKey: ["credentials", "pending-count"],
    queryFn: async () => {
      const endpoint = isHolder ? "/users/self/credentials" : "/credentials";
      const response = await api.get<PaginatedResponse<CredentialDTO>>(endpoint, {
        params: { limit: 1, filters: REVIEW_FILTERS.pending },
      });
      return response.data.total;
    },
  });

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
      "credentials",
      { search: debouncedSearch || undefined, sort: credSort, filters: filterArray },
    ],
    async (page, limit) => {
      const q: Record<string, unknown> = {};
      q.page = page;
      q.limit = limit;
      if (debouncedSearch) q.search = debouncedSearch;
      q.sorts = [credSort];
      if (filterArray.length > 0) q.filters = filterArray;
      q.includes = [
        "holder",
        "issuer",
        "revoker",
        "rejecter",
        "competencies",
        "type",
        "issuer_organization",
      ];
      const endpoint = isHolder ? "/users/self/credentials" : "/credentials";
      const response = await api.get(endpoint, { params: q });
      return response.data;
    },
  );

  const isEmpty = !isLoading && credentials.length === 0;
  const selectionFull = selectedIds.size >= MAX_SELECTION;

  const revoke = useRevokeCredentials();
  const reExtract = useReExtractCredentials();
  const approve = useApproveCredentials();
  const reject = useRejectCredentials();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const { data: units } = useUserUnits();
  const unitNames = useMemo(() => new Map((units ?? []).map((u) => [u.id, u.name])), [units]);

  const eligibleRevokeIds = Array.from(selectedIds).filter((id) =>
    credentials.some((c) => c.id === id && isEligibleFor(c, "revoke")),
  );
  const eligibleReExtractIds = Array.from(selectedIds).filter((id) =>
    credentials.some((c) => c.id === id && isEligibleFor(c, "reextract")),
  );
  const eligibleApproveIds = Array.from(selectedIds).filter((id) =>
    credentials.some((c) => c.id === id && isEligibleFor(c, "approve")),
  );
  const eligibleRejectIds = Array.from(selectedIds).filter((id) =>
    credentials.some((c) => c.id === id && isEligibleFor(c, "reject")),
  );

  const rejectItems = credentials
    .filter((c) => eligibleRejectIds.includes(c.id))
    .map((c) => ({ id: c.id, name: c.name }));

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

  const handleBulkApprove = () => {
    if (eligibleApproveIds.length === 0) return;
    approve.mutate(eligibleApproveIds, { onSuccess: () => exitMode() });
  };

  const handleRejectSubmit = (rejections: { id: string; reason: string }[]) => {
    reject.mutate(rejections, {
      onSuccess: () => {
        setRejectModalOpen(false);
        exitMode();
      },
    });
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

    if (bulkMode === "approve") {
      return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="outline" onClick={exitMode} disabled={approve.isPending}>
            {t("cred.card.cancel")}
          </Button>
          <Button
            variant="gold"
            onClick={handleBulkApprove}
            disabled={eligibleApproveIds.length === 0 || approve.isPending}
          >
            {approve.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {t("cred.card.approveSelectedCount", { count: eligibleApproveIds.length })}
          </Button>
        </div>
      );
    }

    if (bulkMode === "reject") {
      return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="outline" onClick={exitMode} disabled={reject.isPending}>
            {t("cred.card.cancel")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setRejectModalOpen(true)}
            disabled={eligibleRejectIds.length === 0 || reject.isPending}
          >
            <XCircle className="h-4 w-4 text-error" />
            {t("cred.card.rejectSelectedCount", { count: eligibleRejectIds.length })}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => enterMode("approve")}>
          <CheckCircle2 className="h-4 w-4" />
          {t("cred.card.approveMode")}
        </Button>
        <Button variant="outline" onClick={() => enterMode("reject")}>
          <XCircle className="h-4 w-4" />
          {t("cred.card.rejectMode")}
        </Button>
        <Button variant="outline" onClick={() => enterMode("revoke")}>
          <Ban className="h-4 w-4" />
          {t("cred.card.revokeMode")}
        </Button>
        <Button variant="outline" onClick={() => enterMode("reextract")}>
          <RefreshCw className="h-4 w-4" />
          {t("cred.card.reExtractMode")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="sm:ml-auto">
              <Library className="h-4 w-4" />
              {t("cred.references.label")}
              <ChevronDown className="ml-1 h-3 w-3 text-gray-400" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/credential-types">{t("cred.references.types")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/credential-issuer-organizations">
                {t("cred.references.organizations")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/competencies">{t("cred.references.competencies")}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button asChild variant="outline">
          <Link to="/credentials/verify">
            <ShieldCheck className="h-4 w-4" />
            {t("cred.list.verifyCta")}
          </Link>
        </Button>
        <Button asChild variant="gold">
          <Link to="/credentials/issue">
            <FileBadge className="h-4 w-4" />
            {t("cred.list.issueCta")}
          </Link>
        </Button>
      </div>
    );
  };

  const handleReviewChange = (value: CredentialReviewStatus) => {
    if (value === review) return;
    const newSort = adjustSortForStatus(credSort, review, value);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "all") next.delete("review");
      else next.set("review", value);
      if (newSort === SORT_OPTIONS[0].getSort(value)) next.delete("sort");
      else next.set("sort", newSort);
      return next;
    });
    reset();
  };

  const handleExtractChange = (value: CredentialExtractFilter) => {
    if (value === extract) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "any") next.delete("extract");
      else next.set("extract", value);
      return next;
    });
    reset();
  };

  const handleFilterChange = (param: string) => (value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(param, value);
      else next.delete(param);
      return next;
    });
    reset();
  };

  const handleSortChange = (sortString: string) => {
    if (sortString === credSort) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const defaultSort = SORT_OPTIONS[0].getSort(review);
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
        title={t(isHolder ? "cred.mine.title" : "cred.list.title")}
        description={t(isHolder ? "cred.mine.description" : "cred.list.description")}
      />
      {renderActions()}

      <Card className="p-0">
        <div className="border-b border-gray-50 p-4 sm:p-6">
          <div className="space-y-3">
            <div className="w-full md:max-w-2xl">
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
            <div className="flex flex-wrap items-center gap-2">
              <CredentialStatusMenu
                review={review}
                extract={extract}
                onReviewChange={handleReviewChange}
                onExtractChange={handleExtractChange}
                pendingCount={pendingCountQuery.data}
              />
              <CredentialTypeFilterMenu value={typeId} onChange={handleFilterChange("type_id")} />
              <CredentialOrganizationFilterMenu
                value={orgId}
                onChange={handleFilterChange("org_id")}
              />
              <CredentialCompetencyFilterMenu
                value={competencyId}
                onChange={handleFilterChange("competency_id")}
              />
              <HolderUnitFilterMenu value={unitId} onChange={handleFilterChange("unit_id")} />
              <CredentialSortMenu
                value={credSort}
                onChange={handleSortChange}
                statusFilter={review === "revoked" ? "revoked" : "all"}
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
                  : isHolder
                    ? t("cred.mine.empty.title")
                    : t("cred.list.empty.none.title")
              }
              description={
                debouncedSearch
                  ? t("cred.list.empty.search.body")
                  : isHolder
                    ? t("cred.mine.empty.body")
                    : t("cred.list.empty.none.body")
              }
              className="rounded-none border-0 bg-transparent shadow-none"
            />
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {credentials.map((cred) => {
                const isSelectable = isEligibleFor(cred, bulkMode);
                return (
                  <CredentialCard
                    key={cred.id}
                    credential={cred}
                    selectionMode={canManage ? bulkMode : undefined}
                    isSelected={canManage ? selectedIds.has(cred.id) : undefined}
                    onSelect={canManage ? () => toggleSelection(cred.id) : undefined}
                    selectDisabled={
                      canManage && bulkMode
                        ? !isSelectable || (selectionFull && !selectedIds.has(cred.id))
                        : undefined
                    }
                    blockLinks={!canManage}
                    canReview={canManage}
                    canManage={canManage}
                    onApprove={(id) => approve.mutate([id])}
                    onReject={(rejections) => reject.mutate(rejections)}
                    isApproving={approve.isPending}
                    isRejecting={reject.isPending}
                    isHolder={isHolder}
                    holderUnitName={
                      cred.holder?.unit_id ? unitNames.get(cred.holder.unit_id) : undefined
                    }
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

      <CredentialRejectReasonModal
        open={rejectModalOpen}
        onOpenChange={setRejectModalOpen}
        items={rejectItems}
        onSubmit={handleRejectSubmit}
        isSubmitting={reject.isPending}
      />
    </div>
  );
}
