import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  ChevronDown,
  Clock,
  FileBadge,
  Hash,
  Mail,
  Phone,
  Search,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useUser } from "./api/useUser";
import { useLoadMore } from "@shared/hooks/useLoadMore";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { api } from "@shared/api/client";
import type { CredentialDTO, UserDTO } from "@shared/types/api";
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
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { Skeleton } from "@ui/skeleton";
import { CredentialCard } from "@shared/components/CredentialCard";
import { CredentialStatusFilterMenu } from "@shared/components/CredentialStatusFilterMenu";
import type { CredentialStatusFilter } from "@shared/components/CredentialStatusFilterMenu";
import { CredentialSortMenu } from "@shared/components/CredentialSortMenu";
import { Role, ROLE_LEVEL } from "@shared/auth/role";
import { formatDate, formatDateTime } from "@shared/lib/format";
import { cn } from "@shared/lib/cn";

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

export function UserDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading, isError } = useUser(id ?? "");

  // Credential section state
  const [searchParams, setSearchParams] = useSearchParams();
  const [metaOpen, setMetaOpen] = useState(false);

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
        return [...base, "revoked_at_", "extract_status!=failed"];
      case "revoked":
        return [...base, "revoked_at!_", "extract_status!=failed"];
      case "pending":
        return [...base, "extract_status=pending"];
      case "failed":
        return [...base, "extract_status=failed"];
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
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-6 sm:p-8">
          {/* Header: avatar + name + badges */}
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
              <UserRoleBadge role={user.role} />
              <UserStatusBadge deletedAt={user.deleted_at} />
            </div>
          </div>

          <hr className="my-6 border-gray-50" />

          {/* Attribute grid */}
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DetailRow icon={Hash} label={t("user.detail.number")} value={user.number ?? "—"} />
            <DetailRow icon={Mail} label={t("user.detail.email")} value={user.email} />
            <DetailRow
              icon={Phone}
              label={t("user.detail.phone")}
              value={(user as UserDTO & { phone_number?: string | null }).phone_number ?? "—"}
            />
            <div>
              <dt className="mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wider text-gray-400 uppercase">
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                {t("user.detail.walletAddress")}
              </dt>
              <dd className="text-sm break-all text-navy">
                <MonoId value={user.wallet_address} mode="address" className="text-sm text-navy" />
                <CopyInlineButton
                  value={user.wallet_address}
                  ariaLabel="Copy wallet address"
                  className="ml-1 shrink-0"
                />
              </dd>
            </div>
            <DetailRow
              icon={Users}
              label={t("user.field.gender")}
              value={user.gender ? t(`user.field.gender.${user.gender}`) : "—"}
            />
            <DetailRow
              icon={Calendar}
              label={t("user.detail.birthDate")}
              value={user.birth_date ? formatDate(user.birth_date) : "—"}
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

          {/* Metadata (collapsible) */}
          {user.meta && Object.keys(user.meta).length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => setMetaOpen(!metaOpen)}
                className="flex items-center gap-1.5 py-2 text-sm font-medium text-gray-500 hover:text-navy"
              >
                {t("user.detail.metadata")}
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", metaOpen && "rotate-180")}
                />
              </button>
              {metaOpen && (
                <div className="mt-4 rounded-xl bg-gray-50 p-4">
                  <MetaDisplay meta={user.meta} />
                </div>
              )}
            </div>
          )}
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
                placeholder={t("user.detail.credentials.searchPlaceholder")}
                value={credSearch}
                onChange={(e) => handleCredSearchChange(e.target.value)}
                aria-label={t("user.detail.credentials.searchPlaceholder")}
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
                <CredentialCard key={cred.id} credential={cred} />
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
