import { useState } from "react";
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
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { useOverview } from "./api/useOverview";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { PageHeader } from "@shared/components/PageHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { DecorBlob } from "@shared/components/DecorBlob";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import { MonoId } from "@shared/components/MonoId";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { UserContactBlock } from "@shared/components/UserContactBlock";
import { Card } from "@ui/card";
import { Skeleton } from "@ui/skeleton";
import { Button } from "@ui/button";
import { cn } from "@shared/lib/cn";
import { DateFilterMenu } from "./components/DateFilterMenu";
import type {
  OverviewRecentCredential,
  OverviewRecentUser,
  UserDTO,
  OverviewCredentialCounts,
  OverviewUserCounts,
  OverviewRecents,
  OverviewChainDetails,
} from "@shared/types/api";

/* ── helpers ── */

function relativeTime(iso: string, t: ReturnType<typeof useTranslation>["t"]): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return t("overview.relativeTime.seconds");
  if (minutes < 60) return t("overview.relativeTime.minutes", { n: minutes });
  if (hours < 24) return t("overview.relativeTime.hours", { n: hours });
  if (days < 7) return t("overview.relativeTime.days", { n: days });
  return t("overview.relativeTime.weeks", { n: weeks });
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
    compact ? "h-28 p-4" : "h-40 p-6",
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
          compact ? "text-3xl" : "text-4xl",
        )}
      >
        {value.toLocaleString()}
      </span>
      <span
        className={cn(
          "mt-2 text-center font-bold tracking-wider text-gray-400 uppercase",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {label}
        {note && (
          <span className="ml-1 block font-normal text-gray-400/70 normal-case">{note}</span>
        )}
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
        compact ? "h-28 p-4" : "h-40 p-6",
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
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className={cn("rounded-lg p-1.5", toneBlock[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <h4 className="flex-1 text-xs font-bold tracking-wider text-gray-400 uppercase">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function RecentSectionFooter({ to, label }: { to: string; label: string }) {
  return (
    <div className="mt-3 flex justify-end">
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
}: {
  cred: OverviewRecentCredential;
  variant: "active" | "revoked";
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const navigate = useNavigate();
  const isRevoked = variant === "revoked";
  const actor = isRevoked ? cred.revoker : cred.issuer;
  const actorPrefix = isRevoked ? "revoker" : "issuer";
  const time =
    isRevoked && cred.revoked_at
      ? relativeTime(cred.revoked_at, t)
      : relativeTime(cred.issued_at, t);

  const handleClick = () => navigate(`/credentials/${cred.id}`);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group -mx-2 cursor-pointer rounded-lg border-t border-gray-100 px-2 py-3 transition-colors first:border-t-0 hover:bg-gray-50/70 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy">
            {cred.name || t("overview.recents.noName")}
          </p>
          <div className="mt-0.5 flex items-center gap-1">
            <MonoId value={cred.id} mode="id" />
            <CopyInlineButton
              value={cred.id}
              ariaLabel={t("cred.copy.credentialId")}
              className="shrink-0"
            />
          </div>
          {cred.holder && (
            <div className="mt-2">
              <UserContactBlock
                user={cred.holder as UserDTO}
                fallbackId={cred.holder.id}
                copyPrefix="holder"
                labelType="full"
                blockLinks
              />
            </div>
          )}
          {actor && (
            <div className="mt-2">
              <UserContactBlock
                user={actor as UserDTO}
                fallbackId={actor.id}
                copyPrefix={actorPrefix}
                labelType="compact"
                tone={isRevoked ? "error" : "default"}
                blockLinks
              />
            </div>
          )}
        </div>
        <time
          dateTime={isRevoked && cred.revoked_at ? cred.revoked_at : cred.issued_at}
          className="mt-0.5 shrink-0 text-xs text-gray-400"
        >
          {time}
        </time>
      </div>
    </div>
  );
}

function UserRow({
  user,
  t,
}: {
  user: OverviewRecentUser;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const navigate = useNavigate();
  const handleClick = () => navigate(`/users/${user.id}`);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group -mx-2 flex cursor-pointer items-start gap-4 rounded-lg border-t border-gray-100 px-2 py-3 transition-colors first:border-t-0 hover:bg-gray-50/70 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <UserContactBlock
          user={user as UserDTO}
          fallbackId={user.id}
          copyPrefix="user"
          labelType="full"
          blockLinks
        />
      </div>
      <time dateTime={user.created_at} className="mt-0.5 shrink-0 text-xs text-gray-400">
        {relativeTime(user.created_at, t)}
      </time>
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
    <Card className="relative overflow-hidden p-6 shadow-lg ring-1 shadow-gold/20 ring-gold/10 sm:p-8">
      <DecorBlob tone="gold" position="top-right" size="lg" />
      <div className="relative z-10">
        <EyebrowLabel tone="navy" className="mb-6">
          {t("overview.credentialCounts")}
        </EyebrowLabel>
        <div
          className={cn(
            "grid",
            compact ? "grid-cols-2 gap-4" : "grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-5",
          )}
        >
          <StatItem
            value={counts.active}
            label={t("overview.counts.active")}
            accent="gold"
            compact={compact}
            className={compact ? "col-span-2" : undefined}
            to="/credentials"
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
      className={compact ? "col-span-2" : undefined}
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
    <Card className="relative overflow-hidden p-6 shadow-lg ring-1 shadow-gold/20 ring-gold/10 sm:p-8">
      <DecorBlob tone="gold" position="top-right" size="lg" />
      <div className="relative z-10">
        <EyebrowLabel tone="navy" className="mb-6">
          {t("overview.userCounts")}
        </EyebrowLabel>
        <div
          className={cn(
            "grid",
            compact ? "grid-cols-2 gap-4" : "grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4",
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
      </div>
    </Card>
  );
}

function RecentActivityCard({
  recents,
  showUsers = false,
}: {
  recents: OverviewRecents;
  showUsers?: boolean;
}) {
  const { t } = useTranslation();
  const activeCredentials = recents.active_credentials ?? [];
  const revokedCredentials = recents.revoked_credentials ?? [];
  const storedUsers = recents.stored_users ?? [];

  const hasAnyActivity =
    activeCredentials.length > 0 ||
    revokedCredentials.length > 0 ||
    (showUsers && storedUsers.length > 0);

  return (
    <Card className="p-6 sm:p-8">
      <EyebrowLabel tone="navy" className="mb-6">
        {t("overview.recents")}
      </EyebrowLabel>
      {hasAnyActivity ? (
        <div className="space-y-6">
          {activeCredentials.length > 0 && (
            <RecentSection
              title={t("overview.recents.activeCredentials")}
              icon={ShieldCheck}
              tone="green"
            >
              {activeCredentials.slice(0, 1).map((cred) => (
                <CredentialRow key={cred.id} cred={cred} variant="active" t={t} />
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
                <CredentialRow key={cred.id} cred={cred} variant="revoked" t={t} />
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
                <UserRow key={u.id} user={u} t={t} />
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
    <Card className="relative overflow-hidden p-6 shadow-lg ring-1 shadow-gold/20 ring-gold/10 sm:p-8">
      <DecorBlob tone="gold" position="top-right" size="lg" />
      <div className="relative z-10">
        <EyebrowLabel tone="navy" className="mb-6">
          {t("overview.chainDetails")}
        </EyebrowLabel>
        <dl className="grid grid-cols-1 gap-6">
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
              <MonoId
                value={details.relayer_address}
                mode="address"
                className="text-sm text-navy"
              />
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
      </div>
    </Card>
  );
}

/* ── main page ── */

export function Overview() {
  const user = useStore((s) => s.user);
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  function parseDateParam(value: string | null): [string, string] {
    if (!value || !value.startsWith("..")) return ["", ""];
    const parts = value.slice(2).split(",");
    return [parts[0] ?? "", parts[1] ?? ""];
  }

  const [dateFrom, setDateFrom] = useState(parseDateParam(searchParams.get("date"))[0]);
  const [dateTo, setDateTo] = useState(parseDateParam(searchParams.get("date"))[1]);
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
      if (from && to) {
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-5">
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </div>
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </>
      ) : data ? (
        user?.role === Role.HOLDER ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <CredentialCountsCard counts={data.credential_counts} compact />
            <RecentActivityCard recents={data.recents} />
          </div>
        ) : (
          <>
            {/* Desktop: stacked columns, no gap */}
            <div className="hidden items-start gap-6 lg:grid lg:grid-cols-2">
              <div className="space-y-6">
                <CredentialCountsCard counts={data.credential_counts} compact />
                <RecentActivityCard recents={data.recents} showUsers />
              </div>
              <div className="space-y-6">
                {data.user_counts && <UserCountsCard counts={data.user_counts} compact />}
                {data.chain_details && <ChainInfoCard details={data.chain_details} />}
              </div>
            </div>

            {/* Mobile: single column, correct order */}
            <div className="space-y-6 lg:hidden">
              <CredentialCountsCard counts={data.credential_counts} compact />
              {data.user_counts && <UserCountsCard counts={data.user_counts} compact />}
              <RecentActivityCard recents={data.recents} showUsers />
              {data.chain_details && <ChainInfoCard details={data.chain_details} />}
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
