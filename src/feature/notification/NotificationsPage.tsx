import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { Bell, Check, ExternalLink, FileBadge, FileCheck2, FileX2, RefreshCw } from "lucide-react";
import { PageHeader } from "@shared/components/PageHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadMoreBar } from "@shared/components/LoadMoreBar";
import { Button } from "@ui/button";
import { Card, CardContent } from "@ui/card";
import { BackLink } from "@shared/components/BackLink";
import { Skeleton } from "@ui/skeleton";
import { useStore } from "@app/store";
import { Role, canAccess } from "@shared/auth/role";
import {
  useNotificationsFeed,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@shared/api/useNotifications";
import { useReferencePendingCount } from "@shared/api/useReferenceData";
import { usePendingReviewCount } from "@shared/api/usePendingReviewCount";
import { formatDateTime } from "@shared/lib/format";
import { notify } from "@shared/lib/notify";
import { cn } from "@shared/lib/cn";
import type { NotificationDTO, NotificationType, ReferenceResource } from "@shared/types/api";

const TYPE_CONFIG: Record<
  NotificationType,
  {
    icon: typeof FileCheck2;
    descriptionKey: string;
  }
> = {
  credential_registered: { icon: FileBadge, descriptionKey: "notifications.typeDesc.registered" },
  credential_approved: { icon: FileCheck2, descriptionKey: "notifications.typeDesc.approved" },
  credential_rejected: { icon: FileX2, descriptionKey: "notifications.typeDesc.rejected" },
  credential_revoked: { icon: FileX2, descriptionKey: "notifications.typeDesc.revoked" },
  credential_type_submitted: {
    icon: FileBadge,
    descriptionKey: "notifications.typeDesc.credential_type_submitted",
  },
  credential_issuer_organization_submitted: {
    icon: FileBadge,
    descriptionKey: "notifications.typeDesc.credential_issuer_organization_submitted",
  },
  competency_submitted: {
    icon: FileBadge,
    descriptionKey: "notifications.typeDesc.competency_submitted",
  },
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

const REFERENCE_QUEUES: { resource: ReferenceResource; labelKey: string }[] = [
  { resource: "credential-types", labelKey: "notifications.review.credentialTypes" },
  {
    resource: "credential-issuer-organizations",
    labelKey: "notifications.review.issuerOrganizations",
  },
  { resource: "competencies", labelKey: "notifications.review.competencies" },
];

function ReviewRow({
  title,
  description,
  isLoading,
  isError,
  onRetry,
  to,
  actionLabel,
  retryLabel,
}: {
  title: string;
  description: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  to?: string;
  actionLabel?: string;
  retryLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 text-sm">
        <h3 className="font-sans font-bold text-navy">{title}</h3>
        <p className="text-gray-600" aria-live="polite" aria-busy={isLoading}>
          {description}
        </p>
      </div>
      {isError ? (
        <Button
          variant="outline"
          size="md"
          onClick={onRetry}
          className="shrink-0 self-start focus-visible:ring-navy sm:self-center"
          aria-label={retryLabel}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t("notifications.pendingReviewCard.retry")}
        </Button>
      ) : !isLoading && to ? (
        <Button
          variant="outline"
          size="md"
          asChild
          className="shrink-0 self-start focus-visible:ring-navy sm:self-center"
        >
          <Link to={to} aria-label={actionLabel}>
            {t("notifications.pendingReviewCard.action")}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function ReferenceReviewRow({
  resource,
  labelKey,
}: {
  resource: ReferenceResource;
  labelKey: string;
}) {
  const { t } = useTranslation();
  const count = useReferencePendingCount(resource);
  return (
    <ReviewRow
      title={t(labelKey)}
      description={
        count.isLoading
          ? t("notifications.review.loading")
          : count.isError
            ? t("notifications.review.unavailable")
            : t("notifications.review.count", { count: count.data ?? 0 })
      }
      isLoading={count.isLoading}
      isError={count.isError}
      onRetry={() => void count.refetch()}
      to={`/${resource}?status=pending`}
      actionLabel={t("notifications.review.action", { resource: t(labelKey) })}
      retryLabel={t("notifications.review.retry", { resource: t(labelKey) })}
    />
  );
}

function notificationDestination(notification: NotificationDTO): string | null {
  if (!notification.subject_type || !notification.subject_id || !notification.subject?.id)
    return null;
  if (notification.subject_type === "credential") {
    return `/credentials?${new URLSearchParams({ search: notification.subject.id })}`;
  }
  const path = {
    credential_type: "credential-types",
    credential_issuer_organization: "credential-issuer-organizations",
    competency: "competencies",
  }[notification.subject_type];
  return `/${path}?${new URLSearchParams({ status: "all", search: notification.subject.name })}`;
}

export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = (i18n.resolvedLanguage ?? i18n.language).startsWith("id") ? "id" : "en";
  const user = useStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const tabId = useId();

  const isIssuerPlus = canAccess(user?.role, Role.ISSUER);

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
  } = useNotificationsFeed({
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

  const handleNotificationClick = async (notif: NotificationDTO) => {
    const destination = notificationDestination(notif);
    if (!destination) return;

    if (!notif.read_at) {
      try {
        await markReadMutation.mutateAsync(notif.id);
      } catch {
        notify.error(t("notifications.markReadError"));
      }
    }
    navigate(destination);
  };

  const handleMarkOneRead = async (e: React.MouseEvent, notif: NotificationDTO) => {
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
          <CardContent className="space-y-4 p-4 sm:p-6">
            <ReviewRow
              title={t("notifications.pendingReviewCard.title")}
              description={
                isPendingLoading
                  ? t("notifications.review.loading")
                  : isPendingError
                    ? t("notifications.pendingReviewCard.unavailable")
                    : (pendingCount ?? 0) === 0
                      ? t("notifications.pendingReviewCard.empty")
                      : t(
                          pendingCount === 1
                            ? "notifications.pendingReviewCard.desc_one"
                            : "notifications.pendingReviewCard.desc_other",
                          { count: pendingCount },
                        )
              }
              isLoading={isPendingLoading}
              isError={isPendingError}
              onRetry={() => void refetchPending()}
              to={(pendingCount ?? 0) > 0 ? "/credentials?review=pending" : undefined}
            />
            {REFERENCE_QUEUES.map((queue) => (
              <ReferenceReviewRow key={queue.resource} {...queue} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label={t("notifications.title")}
        className="flex border-b border-gray-200"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? "all"
              : event.key === "End"
                ? "unread"
                : activeTab === "all"
                  ? "unread"
                  : "all";
          setActiveTab(next);
          document.getElementById(`${tabId}-${next}`)?.focus();
        }}
      >
        <button
          type="button"
          role="tab"
          id={`${tabId}-all`}
          aria-controls={`${tabId}-panel`}
          tabIndex={activeTab === "all" ? 0 : -1}
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
          id={`${tabId}-unread`}
          aria-controls={`${tabId}-panel`}
          tabIndex={activeTab === "unread" ? 0 : -1}
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
      <div
        id={`${tabId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabId}-${activeTab}`}
        tabIndex={0}
        className="space-y-3"
      >
        {isLoading && (
          <p role="status" className="sr-only">
            {t("common.loading")}
          </p>
        )}
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
                const typeCfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.credential_registered;
                const Icon = typeCfg.icon;
                const hasSubject = notificationDestination(notif) !== null;
                const subjectless = notif.subject_type === null && notif.subject_id === null;
                const validDate = Number.isFinite(new Date(notif.created_at).getTime());
                const content = (
                  <>
                    <Icon className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block text-sm font-normal [overflow-wrap:anywhere] text-gray-700">
                        {hasSubject ? (
                          <Trans
                            i18nKey={typeCfg.descriptionKey}
                            values={{ name: notif.subject?.name }}
                            components={{
                              credential: <strong key="credential" className="font-semibold" />,
                            }}
                            tOptions={{ interpolation: { escapeValue: true } }}
                            shouldUnescape
                          />
                        ) : subjectless ? (
                          t(`notifications.subjectless.${notif.type}`)
                        ) : (
                          t(
                            notif.subject_type === "credential"
                              ? "notifications.unavailableCredential"
                              : "notifications.unavailableSubject",
                          )
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
                    {hasSubject ? (
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
