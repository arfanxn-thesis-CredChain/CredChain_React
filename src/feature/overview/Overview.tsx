import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  User,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Layers,
  ArrowRight,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams, Link } from "react-router-dom";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { useOverview } from "./api/useOverview";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { PageHeader } from "@shared/components/PageHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import { MonoId } from "@shared/components/MonoId";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { UserContactBlock } from "@shared/components/UserContactBlock";
import { Card } from "@ui/card";
import { Skeleton } from "@ui/skeleton";
import { Button } from "@ui/button";
import { cn } from "@shared/lib/cn";
import { formatDate } from "@shared/lib/format";
import { DateFilterMenu } from "./components/DateFilterMenu";
import { CredentialRecapCard } from "./components/CredentialRecapCard";
import type {
  OverviewRecentCredential,
  OverviewRecentUser,
  OverviewCredentialCounts,
  OverviewUserCounts,
  OverviewRecents,
  OverviewChainDetails,
} from "@shared/types/api";

/* ── helpers ── */

function relativeTime(
  iso: string,
  t: ReturnType<typeof useTranslation>["t"],
  locale = "en",
): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return "-";
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return t("overview.relativeTime.seconds");
  if (minutes < 60) return t("overview.relativeTime.minutes", { n: minutes });
  if (hours < 24) return t("overview.relativeTime.hours", { n: hours });
  if (days < 7) return t("overview.relativeTime.days", { n: days });
  return formatDate(iso, locale);
}

/* ── stat item ── */

interface StatItemProps {
  value: number;
  label: string;
  accent?: "gold" | "navy";
  note?: string;
  compact?: boolean;
  className?: string;
  to?: string;
}

function StatItem({ value, label, accent, note, compact, className, to }: StatItemProps) {
  const isAccent = accent === "gold";
  const classes = cn(
    "flex flex-col items-center justify-center rounded-2xl border transition-all",
    compact ? "min-h-24 p-3 sm:p-4" : "min-h-40 p-6",
    isAccent
      ? "border-gold/20 bg-gold/10 shadow-sm shadow-gold/10"
      : "border-gray-100 bg-surface shadow-sm",
    to &&
      "cursor-pointer hover:ring-2 hover:ring-gold/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
    className,
  );

  const content = (
    <>
      <span
        className={cn(
          "font-display font-extrabold tracking-tight text-navy",
          compact ? "text-2xl sm:text-3xl" : "text-4xl",
        )}
      >
        {value.toLocaleString()}
      </span>
      <span className="mt-1 text-center text-xs leading-snug font-semibold text-gray-600">
        {label}
        {note && <span className="mt-1 block font-normal text-gray-500">{note}</span>}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}

/* ── skeleton stat ── */

function StatSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-surface shadow-sm",
        compact ? "min-h-24 p-3 sm:p-4" : "min-h-40 p-6",
      )}
    >
      <Skeleton className={cn("rounded-lg", compact ? "h-8 w-16" : "h-10 w-20")} />
      <Skeleton className={cn("rounded-md", compact ? "h-3 w-20" : "h-4 w-24")} />
    </div>
  );
}

/* ── recent section ── */

interface RecentSectionProps {
  title: string;
  icon: LucideIcon;
  tone?: "gold" | "error" | "navy" | "green";
  children: React.ReactNode;
}

const toneBlock = {
  gold: "bg-gold/10 text-gold-text",
  error: "bg-error/10 text-error",
  navy: "bg-navy/10 text-navy",
  green: "bg-green-100 text-green-700",
};

function RecentSection({ title, icon: Icon, tone = "gold", children }: RecentSectionProps) {
  return (
    <article
      aria-label={title}
      className="flex min-w-0 flex-col rounded-xl border border-gray-100 bg-gray-50/50 p-4"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className={cn("rounded-lg p-1.5", toneBlock[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <h3 className="min-w-0 text-xs font-bold tracking-wider text-gray-500 uppercase">
          {title}
        </h3>
      </div>
      {children}
    </article>
  );
}

function RecentSectionFooter({ to, label }: { to: string; label: string }) {
  return (
    <div className="mt-auto flex justify-end pt-4">
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
      >
        {label}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

/* ── recent rows ── */

function CredentialRow({
  cred,
  variant,
  t,
  locale = "en",
  showHolder = true,
}: {
  cred: OverviewRecentCredential;
  variant: "active" | "revoked";
  t: ReturnType<typeof useTranslation>["t"];
  locale?: string;
  showHolder?: boolean;
}) {
  const isRevoked = variant === "revoked";
  const actor = isRevoked ? cred.revoker : cred.issuer;
  const actorPrefix = isRevoked ? "revoker" : "issuer";
  const timestamp = isRevoked && cred.revoked_at ? cred.revoked_at : cred.issued_at;

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <Link
          to={`/credentials?credential_id=${cred.id}`}
          className="min-w-0 text-sm font-semibold text-navy hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
        >
          <span className="line-clamp-2 break-words">
            {cred.name || t("overview.recents.noName")}
          </span>
        </Link>
        <time dateTime={timestamp} className="shrink-0 pt-0.5 text-xs text-gray-500">
          {relativeTime(timestamp, t, locale)}
        </time>
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-1">
        <MonoId value={cred.id} mode="id" />
        <CopyInlineButton
          value={cred.id}
          ariaLabel={t("cred.copy.credentialId")}
          className="shrink-0"
        />
      </div>
      {((showHolder && cred.holder) || actor) && (
        <div className="mt-3 space-y-3">
          {showHolder && cred.holder && (
            <UserContactBlock
              user={cred.holder}
              fallbackId={cred.holder.id}
              copyPrefix="holder"
              labelType="full"
            />
          )}
          {actor && (
            <UserContactBlock
              user={actor}
              fallbackId={actor.id}
              copyPrefix={actorPrefix}
              labelType="compact"
              tone={isRevoked ? "error" : "default"}
            />
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  t,
  locale = "en",
}: {
  user: OverviewRecentUser;
  t: ReturnType<typeof useTranslation>["t"];
  locale?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <UserContactBlock user={user} fallbackId={user.id} copyPrefix="user" labelType="full" />
        </div>
        <time dateTime={user.created_at} className="shrink-0 pt-0.5 text-xs text-gray-500">
          {relativeTime(user.created_at, t, locale)}
        </time>
      </div>
    </div>
  );
}

/* ── cards ── */

function CredentialCountsCard({
  counts,
  compact,
}: {
  counts: OverviewCredentialCounts;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl font-semibold tracking-tight text-navy">
        {t("overview.credentialCounts")}
      </h2>
      <div
        className={cn(
          "grid gap-3 sm:gap-4",
          compact
            ? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            : "grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-5",
        )}
      >
        <StatItem
          value={counts.active}
          label={t("overview.counts.active")}
          accent="gold"
          compact={compact}
          className={compact ? "col-span-2 lg:col-span-1" : undefined}
          to="/credentials?review=approved"
        />
        <StatItem
          value={counts.total}
          label={t("overview.counts.total")}
          compact={compact}
          to="/credentials"
        />
        <StatItem
          value={counts.revoked}
          label={t("overview.counts.revoked")}
          compact={compact}
          to="/credentials?review=revoked"
        />
        <StatItem
          value={counts.pending}
          label={t("overview.counts.pending")}
          compact={compact}
          to="/credentials?extract=pending"
        />
        <StatItem
          value={counts.failed}
          label={t("overview.counts.failed")}
          compact={compact}
          to="/credentials?extract=failed"
        />
      </div>
    </Card>
  );
}

function UserCountsCard({ counts, compact }: { counts: OverviewUserCounts; compact?: boolean }) {
  const { t } = useTranslation();
  const activeStat = (
    <StatItem
      value={counts.active}
      label={t("overview.counts.activeUsers")}
      accent="gold"
      compact={compact}
      className={compact ? "col-span-2 lg:col-span-1" : undefined}
      to="/users?status=deleted_at_"
    />
  );
  const otherStats = (
    <>
      <StatItem
        value={counts.total}
        label={t("overview.counts.total")}
        compact={compact}
        to="/users"
      />
      <StatItem
        value={counts.holder}
        label={t("overview.counts.holder")}
        compact={compact}
        to="/users?role=holder"
      />
      <StatItem
        value={counts.issuer}
        label={t("overview.counts.issuer")}
        compact={compact}
        to="/users?role=issuer"
      />
      <StatItem
        value={counts.admin}
        label={t("overview.counts.admin")}
        compact={compact}
        to="/users?role=admin"
      />
      <StatItem
        value={counts.super_admin}
        label={t("overview.counts.superAdmin")}
        note={t("overview.superAdminAlwaysOne")}
        compact={compact}
        to="/users?role=super_admin"
      />
      <StatItem
        value={counts.trashed}
        label={t("overview.counts.trashed")}
        compact={compact}
        to="/users?status=deleted_at!_"
      />
    </>
  );
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl font-semibold tracking-tight text-navy">
        {t("overview.userCounts")}
      </h2>
      <div
        className={cn(
          "grid gap-3 sm:gap-4",
          compact
            ? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {compact ? (
          <>
            {activeStat}
            {otherStats}
          </>
        ) : (
          <>
            {otherStats}
            {activeStat}
          </>
        )}
      </div>
    </Card>
  );
}

function RecentActivityCard({
  recents,
  showUsers = false,
  showHolder = true,
}: {
  recents: OverviewRecents;
  showUsers?: boolean;
  showHolder?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const activeCredentials = recents.active_credentials ?? [];
  const revokedCredentials = recents.revoked_credentials ?? [];
  const storedUsers = recents.stored_users ?? [];

  const sectionCount =
    Number(activeCredentials.length > 0) +
    Number(revokedCredentials.length > 0) +
    Number(showUsers && storedUsers.length > 0);

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl font-semibold tracking-tight text-navy">
        {t("overview.recents")}
      </h2>
      {sectionCount > 0 ? (
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            sectionCount > 1 && "sm:grid-cols-2",
            sectionCount === 3 ? "lg:grid-cols-3" : sectionCount === 2 && "lg:grid-cols-2",
          )}
        >
          {activeCredentials.length > 0 && (
            <RecentSection
              title={t("overview.recents.activeCredentials")}
              icon={ShieldCheck}
              tone="green"
            >
              {activeCredentials.slice(0, 1).map((cred) => (
                <CredentialRow
                  key={cred.id}
                  cred={cred}
                  variant="active"
                  t={t}
                  locale={i18n.language}
                  showHolder={showHolder}
                />
              ))}
              <RecentSectionFooter
                to="/credentials"
                label={t("overview.recents.viewAllCredentials")}
              />
            </RecentSection>
          )}

          {revokedCredentials.length > 0 && (
            <RecentSection
              title={t("overview.recents.revokedCredentials")}
              icon={ShieldAlert}
              tone="error"
            >
              {revokedCredentials.slice(0, 1).map((cred) => (
                <CredentialRow
                  key={cred.id}
                  cred={cred}
                  variant="revoked"
                  t={t}
                  locale={i18n.language}
                  showHolder={showHolder}
                />
              ))}
              <RecentSectionFooter
                to="/credentials?review=revoked"
                label={t("overview.recents.viewAllCredentials")}
              />
            </RecentSection>
          )}

          {showUsers && storedUsers.length > 0 && (
            <RecentSection title={t("overview.recents.storedUsers")} icon={User} tone="navy">
              {storedUsers.slice(0, 1).map((u) => (
                <UserRow key={u.id} user={u} t={t} locale={i18n.language} />
              ))}
              <RecentSectionFooter to="/users" label={t("overview.recents.viewAllUsers")} />
            </RecentSection>
          )}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-gray-400 italic">
          {t("overview.recents.empty")}
        </p>
      )}
    </Card>
  );
}

function ChainInfoCard({ details }: { details: OverviewChainDetails }) {
  const { t } = useTranslation();
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl font-semibold tracking-tight text-navy">
        {t("overview.chainDetails")}
      </h2>
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <EyebrowLabel as="dt" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {t("overview.chainDetails.authorityContract")}
          </EyebrowLabel>
          <dd className="flex items-center gap-2">
            <MonoId
              value={details.authority_contract}
              mode="address"
              className="text-sm text-navy"
            />
            <CopyInlineButton
              value={details.authority_contract}
              ariaLabel={t("overview.chainDetails.copyAuthority")}
            />
          </dd>
        </div>
        <div>
          <EyebrowLabel as="dt" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {t("overview.chainDetails.registryContract")}
          </EyebrowLabel>
          <dd className="flex items-center gap-2">
            <MonoId
              value={details.registry_contract}
              mode="address"
              className="text-sm text-navy"
            />
            <CopyInlineButton
              value={details.registry_contract}
              ariaLabel={t("overview.chainDetails.copyRegistry")}
            />
          </dd>
        </div>
        <div>
          <EyebrowLabel as="dt" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {t("overview.chainDetails.lastBlock")}
          </EyebrowLabel>
          <dd className="font-display text-2xl font-bold tracking-tight text-navy">
            {details.last_block === 0
              ? t("overview.chainDetails.unavailable")
              : details.last_block.toLocaleString()}
          </dd>
        </div>
        <div>
          <EyebrowLabel as="dt" className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            {t("overview.chainDetails.relayerWallet")}
          </EyebrowLabel>
          <dd className="flex items-center gap-2">
            <MonoId value={details.relayer_address} mode="address" className="text-sm text-navy" />
            <CopyInlineButton
              value={details.relayer_address}
              ariaLabel={t("overview.chainDetails.copyRelayer")}
            />
          </dd>
        </div>
        <div>
          <EyebrowLabel as="dt" className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            {t("overview.chainDetails.relayerBalance")}
          </EyebrowLabel>
          <dd className="font-display text-2xl font-bold tracking-tight text-navy">
            {details.relayer_balance} <span className="font-sans text-sm text-gray-500">ETH</span>
          </dd>
        </div>
      </dl>
    </Card>
  );
}

/* ── main page ── */

export function Overview() {
  const user = useStore((s) => s.user);
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => prev + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  function parseDateParam(value: string | null): [string, string] {
    if (!value || !value.startsWith("..")) return ["", ""];
    const parts = value.slice(2).split(",");
    return [parts[0] ?? "", parts[1] ?? ""];
  }

  const [dateFrom, setDateFrom] = useState(parseDateParam(searchParams.get("date"))[0]);
  const [dateTo, setDateTo] = useState(parseDateParam(searchParams.get("date"))[1]);
  const urlDate = searchParams.get("date");
  const [previousUrlDate, setPreviousUrlDate] = useState(urlDate);
  if (previousUrlDate !== urlDate) {
    setPreviousUrlDate(urlDate);
    const [from, to] = parseDateParam(urlDate);
    setDateFrom(from);
    setDateTo(to);
  }
  const debouncedFrom = useDebouncedValue(dateFrom, 300);
  const debouncedTo = useDebouncedValue(dateTo, 300);

  const filters: string[] = [];
  if (debouncedFrom && debouncedTo) {
    filters.push(`date..${debouncedFrom},${debouncedTo}`);
  } else if (debouncedFrom) {
    filters.push(`date..${debouncedFrom},`);
  } else if (debouncedTo) {
    filters.push(`date..,${debouncedTo}`);
  }

  const { data, isLoading, isError, refetch } = useOverview(
    filters.length > 0 ? { filters } : undefined,
  );

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (from || to) {
        next.set("date", `..${from},${to}`);
      } else {
        next.delete("date");
      }
      // Remove any legacy params that may still be present in old bookmarks.
      next.delete("dateFrom");
      next.delete("dateTo");
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={t("overview.welcome", {
          name: user?.name?.split(" ")[0] ?? t("overview.fallbackName"),
        })}
        description={t("overview.description")}
        action={<DateFilterMenu dateFrom={dateFrom} dateTo={dateTo} onChange={handleDateChange} />}
      />

      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title={t("overview.error.title")}
          description={t("overview.error.body")}
          action={
            <Button variant="primary" onClick={() => refetch()}>
              {t("overview.error.retry")}
            </Button>
          }
        />
      ) : isLoading ? (
        <>
          <Skeleton className="h-64 rounded-2xl" />
          {user?.role !== Role.HOLDER && (
            <Card className="p-5 sm:p-6">
              <Skeleton className="mb-4 h-6 w-28" />
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 7 }, (_, index) => (
                  <StatSkeleton key={index} compact />
                ))}
              </div>
            </Card>
          )}
          <Card className="p-5 sm:p-6">
            <Skeleton className="mb-4 h-6 w-32" />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <StatSkeleton key={index} compact />
              ))}
            </div>
          </Card>
          {user?.role !== Role.HOLDER && <Skeleton className="h-72 rounded-2xl" />}
        </>
      ) : data ? (
        user?.role === Role.HOLDER ? (
          <div className="space-y-6">
            <RecentActivityCard recents={data.recents} showHolder={false} />
            <CredentialCountsCard counts={data.credential_counts} compact />
          </div>
        ) : (
          <>
            <RecentActivityCard recents={data.recents} showUsers />
            {data.user_counts && <UserCountsCard counts={data.user_counts} compact />}
            <CredentialCountsCard counts={data.credential_counts} compact />
            <CredentialRecapCard />
            {data.chain_details && <ChainInfoCard details={data.chain_details} />}
          </>
        )
      ) : null}
    </div>
  );
}
