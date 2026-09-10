import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Calendar, CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { cn } from "@shared/lib/cn";
import { formatDate } from "@shared/lib/format";
import { lifecycleDateLines, primaryDateLine } from "@shared/lib/credentialDate";
import { isEligibleFor, type BulkMode } from "@shared/lib/credentialEligibility";
import { Card } from "@ui/card";
import { Button } from "@ui/button";
import { FormField } from "@ui/form-field";
import { Input } from "@ui/input";
import { notify } from "@shared/lib/notify";
import { UserAvatar } from "@shared/components/UserAvatar";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import type { CredentialDTO, UserDTO } from "@shared/types/api";
import { CredentialStatusBadge } from "./CredentialStatusBadge";
import { CredentialExtractNote } from "./CredentialExtractNote";

interface CredentialCardProps {
  credential: CredentialDTO;
  isSelected?: boolean;
  selectionMode?: BulkMode;
  onSelect?: () => void;
  selectDisabled?: boolean;
  blockLinks?: boolean;
  /** Opt-in: reveal inline Approve/Reject affordances on a pending card. */
  canReview?: boolean;
  /** Issuer+ only: reveals internal extract-pipeline status note. */
  canManage?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (rejections: { id: string; reason: string }[]) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  /** Holder sees who issued it; everyone else sees who holds it. Defaults to the issuer+ view. */
  isHolder?: boolean;
  /** Holder-profile view: the holder is the page subject, so show who acted on the
   *  credential instead — the issuer, or the revoker once it is revoked. */
  showActor?: boolean;
  /** Resolved unit name for the holder, looked up by the parent from the shared units cache. */
  holderUnitName?: string;
}

const INTERACTIVE_SELECTORS = "a,button,[role='button'],input,textarea,select";

function PersonRow({
  user,
  userId,
  subline,
  blockLinks,
  label,
  tone,
}: {
  user?: UserDTO | null;
  userId: string;
  subline?: string;
  blockLinks?: boolean;
  label?: string;
  tone?: "error";
}) {
  const name = user?.name ?? user?.email ?? userId;

  return (
    <div className="min-w-0">
      {label && (
        <EyebrowLabel
          as="span"
          className={cn("mb-1 block", tone === "error" && "text-error")}
        >
          {label}
        </EyebrowLabel>
      )}
      <div className="flex min-w-0 items-center gap-2">
        <UserAvatar user={user ?? null} size="sm" className="shrink-0" />
        <div className="min-w-0">
          {blockLinks ? (
            <p
              className={cn(
                "truncate text-sm font-semibold",
                tone === "error" ? "text-error" : "text-navy",
              )}
            >
              {name}
            </p>
          ) : (
            <Link
              to={`/users/${userId}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "block truncate text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                tone === "error" ? "text-error" : "text-navy",
              )}
            >
              {name}
            </Link>
          )}
          {subline && <p className="truncate text-xs text-gray-500">{subline}</p>}
        </div>
      </div>
    </div>
  );
}

function ActorRow({
  credential,
  blockLinks,
}: {
  credential: CredentialDTO;
  blockLinks?: boolean;
}) {
  const { t } = useTranslation();
  const revoked = credential.status === "revoked";

  if (revoked) {
    if (credential.revoker || credential.revoker_user_id) {
      return (
        <PersonRow
          user={credential.revoker}
          userId={credential.revoker_user_id ?? ""}
          subline={credential.revoker?.number ?? undefined}
          blockLinks={blockLinks}
          label={t("cred.detail.revoker")}
          tone="error"
        />
      );
    }
    return <p className="text-sm text-gray-500">—</p>;
  }

  if (credential.holder_user_id === credential.issuer_user_id) {
    return <p className="text-sm text-gray-500">{t("cred.parties.selfSubmitted")}</p>;
  }

  return (
    <PersonRow
      user={credential.issuer}
      userId={credential.issuer_user_id}
      subline={credential.issuer?.number ?? undefined}
      blockLinks={blockLinks}
      label={t("cred.detail.issuer")}
    />
  );
}

function CardCounterparty({
  credential,
  isHolder,
  showActor,
  holderUnitName,
  blockLinks,
}: {
  credential: CredentialDTO;
  isHolder: boolean;
  showActor?: boolean;
  holderUnitName?: string;
  blockLinks?: boolean;
}) {
  const { t } = useTranslation();

  if (showActor) {
    return <ActorRow credential={credential} blockLinks={blockLinks} />;
  }

  if (isHolder) {
    const resolvedName = credential.issuer_organization?.name;
    const stagedName = credential.submitted_issuer_organization_name;
    const isIssued = credential.holder_user_id !== credential.issuer_user_id;
    const isRevoked = credential.status === "revoked";
    const showActorRow = isRevoked || isIssued;

    const orgElement = resolvedName ? (
      <p className="truncate text-sm font-semibold text-navy">{resolvedName}</p>
    ) : stagedName ? (
      <p className="flex items-center gap-1.5 text-sm text-gray-500">
        <CircleDashed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">
          {stagedName} · {t("cred.metadata.pending")}
        </span>
      </p>
    ) : (
      <p className="text-sm text-gray-500">—</p>
    );

    return (
      <div className="space-y-2">
        {orgElement}
        {showActorRow && <ActorRow credential={credential} blockLinks={blockLinks} />}
      </div>
    );
  }

  const holder = credential.holder;
  const subline = [holder?.number, holderUnitName].filter(Boolean).join(" · ");

  return (
    <PersonRow
      user={holder}
      userId={credential.holder_user_id}
      subline={subline || undefined}
      blockLinks={blockLinks}
    />
  );
}

export function CredentialCard({
  credential,
  isSelected,
  selectionMode,
  onSelect,
  selectDisabled,
  blockLinks,
  canReview,
  canManage,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  isHolder,
  showActor,
  holderUnitName,
}: CredentialCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);

  const revoked = credential.status === "revoked";
  const canInlineReview = canReview && !selectionMode && credential.status === "pending";
  const hasUnresolvedMetadata = (credential.unresolved_metadata?.length ?? 0) > 0;
  const competencyNames = [
    ...(credential.competencies ?? []).map((c) => c.name),
    ...(credential.submitted_competencies ?? [])
      .filter((c) => c.resolved_id === null)
      .map((c) => c.name),
  ];
  const showLifecycleDates = credential.status === "revoked" || credential.status === "rejected";
  const dateLine = primaryDateLine(credential, !!isHolder);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleApproveClick = (e: React.MouseEvent) => {
    stop(e);
    onApprove?.(credential.id);
  };

  const handleRejectToggle = (e: React.MouseEvent) => {
    stop(e);
    setRejectOpen((v) => !v);
    setReason("");
    setReasonMissing(false);
  };

  const handleRejectConfirm = (e: React.MouseEvent) => {
    stop(e);
    if (!reason.trim()) {
      setReasonMissing(true);
      return;
    }
    onReject?.([{ id: credential.id, reason: reason.trim() }]);
  };

  const handleCompleteDetailsClick = (e: React.MouseEvent) => {
    stop(e);
    navigate(`/credentials/${credential.id}`);
  };

  const isSelectable = isEligibleFor(credential, selectionMode ?? null);
  const selectBlocked = !!selectionMode && (!isSelectable || !!selectDisabled);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTORS)) return;
    if (selectionMode) {
      if (isSelectable && !selectDisabled) {
        onSelect?.();
      } else if (!isSelectable) {
        if (selectionMode === "revoke") {
          notify.info("cred.card.alreadyRevoked");
        } else if (selectionMode === "approve" || selectionMode === "reject") {
          notify.info("cred.card.notPendingReview");
        } else {
          notify.info(
            credential.extract_state === "succeeded"
              ? "cred.card.alreadySucceeded"
              : "credential.reextract.not_eligible",
          );
        }
      }
      return;
    }
    navigate(`/credentials/${credential.id}`);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (selectionMode) {
      if (isSelectable && !selectDisabled) onSelect?.();
      return;
    }
    navigate(`/credentials/${credential.id}`);
  };

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "relative flex h-full cursor-pointer flex-col p-5 transition-all focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
        selectBlocked && "cursor-not-allowed opacity-50",
        revoked
          ? "border-error/20 bg-error/5"
          : "border-gray-100 hover:border-gold/50 hover:shadow-md",
      )}
      aria-label={revoked ? t("cred.status.revoked") : t("cred.status.active")}
    >
      {selectionMode && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isSelectable && !selectDisabled) onSelect?.();
          }}
          disabled={selectBlocked}
          className={cn(
            "absolute top-4 right-4 z-10 h-5 w-5 rounded border-2 transition-colors",
            "focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
            selectBlocked && "cursor-not-allowed",
            isSelected ? "border-gold bg-gold" : "border-gray-300 hover:border-gold",
          )}
          aria-pressed={isSelected}
          aria-label={isSelected ? t("cred.card.deselect") : t("cred.card.select")}
        />
      )}

      <div className={cn("flex flex-1 flex-col", selectionMode && "pr-8")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <CredentialStatusBadge status={credential.status} />
          {credential.type?.name && (
            <EyebrowLabel as="span" className="mb-0 min-w-0 wrap-break-word">
              {credential.type.name}
            </EyebrowLabel>
          )}
        </div>

        {canManage && (
          <div className="mb-2 wrap-anywhere">
            <CredentialExtractNote
              state={credential.extract_state}
              error={credential.extract_error}
            />
          </div>
        )}

        <h3 className="mb-3 line-clamp-2 font-sans text-lg font-bold wrap-break-word text-navy">
          {credential.name}
        </h3>

        <div className="mb-3">
          <CardCounterparty
            credential={credential}
            isHolder={!!isHolder}
            showActor={showActor}
            holderUnitName={holderUnitName}
            blockLinks={blockLinks || !!selectionMode}
          />
        </div>

        {canInlineReview && hasUnresolvedMetadata ? (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-500">
            <CircleDashed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("cred.card.detailsIncomplete")}
          </p>
        ) : (
          competencyNames.length > 0 && (
            <p className="mb-2 flex items-center gap-1 text-xs text-gray-500">
              <span className="min-w-0 truncate">{competencyNames[0]}</span>
              {competencyNames.length > 1 && (
                <span className="shrink-0">
                  {t("cred.card.competencyOverflow", { count: competencyNames.length - 1 })}
                </span>
              )}
            </p>
          )
        )}

        <div className="space-y-1 text-xs text-gray-500">
          {showLifecycleDates ? (
            lifecycleDateLines(credential).map((line) => (
              <div
                key={line.labelKey}
                className={cn(
                  "flex items-center gap-1.5",
                  line.tone === "error" ? "text-error" : "",
                )}
              >
                <Calendar
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    line.tone === "error" ? "" : "text-gray-400",
                  )}
                  aria-hidden="true"
                />
                <span>
                  {t(line.labelKey)} {formatDate(line.timestamp, i18n.language)}
                </span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
              <span>
                {t(dateLine.labelKey)} {formatDate(dateLine.timestamp, i18n.language)}
              </span>
            </div>
          )}
        </div>

        {canInlineReview && (
          <div className="mt-auto space-y-2 border-t border-gray-100 pt-4">
            {hasUnresolvedMetadata ? (
              <Button
                type="button"
                variant="gold"
                size="sm"
                className="w-full"
                onClick={handleCompleteDetailsClick}
              >
                {t("cred.card.completeDetails")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : !rejectOpen ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  onClick={handleApproveClick}
                  disabled={isApproving}
                >
                  {isApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {t("cred.detail.approve")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleRejectToggle}>
                  <XCircle className="h-4 w-4" />
                  {t("cred.detail.reject")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <FormField
                  label={t("cred.reject.modal.reasonLabel")}
                  error={reasonMissing ? "cred.reject.modal.reasonRequired" : undefined}
                >
                  <Input
                    value={reason}
                    onChange={(e) => {
                      e.stopPropagation();
                      setReason(e.target.value);
                      setReasonMissing(false);
                    }}
                    onClick={stop}
                    maxLength={1000}
                    placeholder={t("cred.reject.modal.reasonPlaceholder")}
                    aria-label={t("cred.reject.modal.reasonLabel")}
                  />
                </FormField>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRejectToggle}
                    disabled={isRejecting}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleRejectConfirm}
                    disabled={isRejecting}
                  >
                    {isRejecting
                      ? t("cred.reject.modal.submitting")
                      : t("cred.reject.modal.submit")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
