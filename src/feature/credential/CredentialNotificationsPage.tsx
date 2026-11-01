import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileBadge,
  FileCheck2,
  FileX2,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@shared/components/PageHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";
import { Button } from "@ui/button";
import { Card, CardContent } from "@ui/card";
import { BackLink } from "@shared/components/BackLink";
import { Skeleton } from "@ui/skeleton";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import {
  useCredentialNotificationsFeed,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@shared/api/useCredentialNotifications";
import { usePendingReviewCount } from "@shared/api/usePendingReviewCount";
import { formatDateTime } from "@shared/lib/format";
import { notify } from "@shared/lib/notify";
import { cn } from "@shared/lib/cn";
import type { CredentialNotificationDTO, CredentialNotificationType } from "@shared/types/api";

const TYPE_CONFIG: Record<
  CredentialNotificationType,
  {
    icon: typeof FileCheck2;
    descriptionKey: string;
  }
> = {
  registered: { icon: FileBadge, descriptionKey: "notifications.typeDesc.registered" },
  approved: { icon: FileCheck2, descriptionKey: "notifications.typeDesc.approved" },
  rejected: { icon: FileX2, descriptionKey: "notifications.typeDesc.rejected" },
  revoked: { icon: FileX2, descriptionKey: "notifications.typeDesc.revoked" },
};

function notificationTime(value: string, locale: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "-";
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed >= 7 * 86_400_000) return formatDateTime(value, locale);
  const relative = new Intl.RelativeTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    numeric: "always",
  });
  const units = [
    [86_400_000, "day"],
    [3_600_000, "hour"],
    [60_000, "minute"],
    [1_000, "second"],
  ] as const;
  const [duration, unit] = units.find(([duration]) => elapsed >= duration) ?? units[3];
  return relative.format(-Math.floor(elapsed / duration), unit);
}

export function CredentialNotificationsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = (i18n.resolvedLanguage ?? i18n.language).startsWith("id") ? "id" : "en";
  const user = useStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");

  const isIssuerPlus =
    user?.role === Role.ISSUER || user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;

  const {
    data: pendingCount,
    isLoading: isPendingLoading,
    isError: isPendingError,
    refetch: refetchPending,
  } = usePendingReviewCount({ enabled: isIssuerPlus });

  const {
    items,
    total,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useCredentialNotificationsFeed({
    status: activeTab,
    limit: 20,
  });

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const handleMarkAllRead = async () => {
    try {
      await markAllReadMutation.mutateAsync();
      notify.success(t("notifications.markAllReadSuccess"));
    } catch {
      notify.error(t("notifications.markAllReadError"));
    }
  };

  const handleNotificationClick = async (notif: CredentialNotificationDTO) => {
    if (!notif.credential?.id) {
      return;
    }
    const credId = notif.credential.id;

    if (!notif.read_at) {
      try {
        await markReadMutation.mutateAsync(notif.id);
      } catch {
        notify.error(t("notifications.markReadError"));
      }
    }
    navigate(`/credentials?${new URLSearchParams({ search: credId }).toString()}`);
  };

  const handleMarkOneRead = async (e: React.MouseEvent, notif: CredentialNotificationDTO) => {
    e.stopPropagation();
    try {
      await markReadMutation.mutateAsync(notif.id);
    } catch {
      notify.error(t("notifications.markReadError"));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <BackLink />
      <PageHeader
        title={t("notifications.title")}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            className="w-full sm:w-auto"
          >
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("notifications.markAllRead")}
          </Button>
        }
      />

      {isIssuerPlus && (
        <Card className="border-gray-200 shadow-none">
          <CardContent className="p-4 sm:p-6">
            {isPendingLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ) : isPendingError ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-500" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-700">
                    {t("notifications.pendingReviewCard.unavailable")}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchPending()}
                  className="sm:self-end"
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                  {t("notifications.pendingReviewCard.retry")}
                </Button>
              </div>
            ) : (pendingCount ?? 0) === 0 ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-gray-500" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-700">
                  {t("notifications.pendingReviewCard.empty")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                  <div>
                    <h4 className="font-sans text-sm font-bold text-navy">
                      {t("notifications.pendingReviewCard.title")}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {pendingCount === 1
                        ? t("notifications.pendingReviewCard.desc_one", { count: pendingCount })
                        : t("notifications.pendingReviewCard.desc_other", { count: pendingCount })}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild className="sm:self-center">
                  <Link to="/credentials?review=pending">
                    {t("notifications.pendingReviewCard.action")}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "all"}
          onClick={() => setActiveTab("all")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
            activeTab === "all"
              ? "border-navy text-navy"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
          )}
        >
          {t("notifications.filter.all")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "unread"}
          onClick={() => setActiveTab("unread")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
            activeTab === "unread"
              ? "border-navy text-navy"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
          )}
        >
          {t("notifications.filter.unread")}
        </button>
      </div>

      {/* Feed List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 border-b border-gray-200 py-4">
                <Skeleton className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-full max-w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={Bell}
            title={t("error_boundary.title")}
            description={t("admin.loadError")}
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("overview.error.retry")}
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={
              activeTab === "unread" ? t("notifications.emptyUnread") : t("notifications.emptyAll")
            }
            description={
              activeTab === "unread"
                ? t("notifications.emptyUnreadDesc")
                : t("notifications.emptyAllDesc")
            }
          />
        ) : (
          <div>
            <ul className="divide-y divide-gray-200 border-y border-gray-200">
              {items.map((notif) => {
                const isUnread = notif.read_at === null;
                const typeCfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.registered;
                const Icon = typeCfg.icon;
                const hasCred = Boolean(notif.credential?.id);
                const validDate = Number.isFinite(new Date(notif.created_at).getTime());
                const content = (
                  <>
                    <Icon className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block text-sm font-normal [overflow-wrap:anywhere] text-gray-700">
                        {hasCred ? (
                          <Trans
                            i18nKey={typeCfg.descriptionKey}
                            values={{ name: notif.credential?.name }}
                            components={{
                              credential: <strong key="credential" className="font-semibold" />,
                            }}
                            tOptions={{ interpolation: { escapeValue: true } }}
                            shouldUnescape
                          />
                        ) : (
                          t("notifications.unavailableCredential")
                        )}
                      </span>
                      <time
                        dateTime={validDate ? notif.created_at : undefined}
                        title={validDate ? formatDateTime(notif.created_at, locale) : undefined}
                        className="block text-xs font-normal text-gray-500"
                      >
                        {notificationTime(notif.created_at, locale)}
                      </time>
                    </span>
                  </>
                );
                return (
                  <li key={notif.id} className="flex items-center gap-2 sm:gap-4">
                    {hasCred ? (
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notif)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-4 text-left transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3 py-4">{content}</div>
                    )}
                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleMarkOneRead(e, notif)}
                        disabled={markReadMutation.isPending}
                        aria-label={t("notifications.markRead")}
                        title={t("notifications.markRead")}
                        className="shrink-0 text-gray-600 hover:text-navy sm:w-auto sm:px-3 sm:text-xs sm:font-medium"
                      >
                        <Check className="shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">{t("notifications.markRead")}</span>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>

            <LoadMoreBar
              total={total}
              hasMore={Boolean(hasNextPage)}
              isLoading={isFetchingNextPage}
              onLoadMore={() => fetchNextPage()}
              countLabel={t("admin.count", {
                shown: items.length,
                total,
              })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
