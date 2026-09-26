import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Calendar, CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { cn } from "@shared/lib/cn";
import { formatDate } from "@shared/lib/format";
import { lifecycleDateLines } from "@shared/lib/credentialDate";
import { isEligibleFor, type BulkMode } from "@shared/lib/credentialEligibility";
import { Card } from "@ui/card";
import { Button } from "@ui/button";
import { Badge } from "@ui/badge";
import { FormField } from "@ui/form-field";
import { Textarea } from "@ui/textarea";
import { notify } from "@shared/lib/notify";
import { UserAvatar } from "@shared/components/UserAvatar";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import { StagedValue } from "@shared/components/StagedValue";
import type { CredentialDTO, UserDTO } from "@shared/types/api";
import {
  CredentialStatusBadge,
  getCredentialStatusLabelKey,
  STATUS_SURFACE,
} from "./CredentialStatusBadge";
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
  /** Holder-profile view: the holder is the page subject, so hide the holder and
   *  dynamically display who acted on the credential instead (issuer, revoker, rejecter). */
  hideHolder?: boolean;
  /** @deprecated Use hideHolder instead */
  showActor?: boolean;
  /** Resolved unit name for the holder, looked up by the parent from the shared units cache. */
  holderUnitName?: string;
  /** Optional handler to open modal/detail. If not provided, navigates to /credentials?credential_id=ID. */
  onOpenDetail?: (id: string) => void;
}

const INTERACTIVE_SELECTORS = "a,button,[role='button'],input,textarea,select";

export function PersonRow({
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
  const isLinked = !blockLinks && Boolean(userId);

  return (
    <div className="min-w-0">
      {label && (
        <EyebrowLabel as="span" className={cn("mb-1 block", tone === "error" && "text-error")}>
          {label}
        </EyebrowLabel>
      )}
      <div className="flex min-w-0 items-center gap-2">
        <UserAvatar user={user ?? null} size="sm" className="shrink-0" />
        <div className="min-w-0">
          {!isLinked ? (
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

function AuditStrip({
  credential,
  blockLinks,
}: {
  credential: CredentialDTO;
  blockLinks?: boolean;
}) {
  const { t } = useTranslation();

  if (credential.status === "pending") {
    return null;
  }

  if (credential.status === "approved" || credential.status === "expired") {
    const wasSubmittedByHolder = credential.submitter_user_id === credential.holder_user_id;
    const label = wasSubmittedByHolder ? t("cred.audit.approvedBy") : t("cred.audit.registeredBy");
    const userId = credential.issuer_user_id;

    if (!userId && !credential.issuer) {
      return (
        <div className="min-w-0">
          <EyebrowLabel as="span" className="mb-1 block">
            {label}
          </EyebrowLabel>
          <p className="text-sm text-gray-500">—</p>
        </div>
      );
    }

    return (
      <PersonRow
        user={credential.issuer}
        userId={userId ?? ""}
        subline={credential.issuer?.number ?? undefined}
        blockLinks={blockLinks}
        label={label}
      />
    );
  }

  if (credential.status === "rejected") {
    const label = t("cred.audit.rejectedBy");
    const userId = credential.rejecter_user_id;

    const personContent =
      !userId && !credential.rejecter ? (
        <div className="min-w-0">
          <EyebrowLabel as="span" className="mb-1 block text-error">
            {label}
          </EyebrowLabel>
          <p className="text-sm text-gray-500">—</p>
        </div>
      ) : (
        <PersonRow
          user={credential.rejecter}
          userId={userId ?? ""}
          subline={credential.rejecter?.number ?? undefined}
          blockLinks={blockLinks}
          label={label}
          tone="error"
        />
      );

    return (
      <div className="space-y-2">
        {personContent}
        {credential.rejection_reason && (
          <div className="rounded-md bg-error/10 p-2.5 text-xs text-error">
            <span className="font-semibold">{t("cred.reject.modal.reasonLabel")}: </span>
            <span className="line-clamp-2">{credential.rejection_reason}</span>
          </div>
        )}
      </div>
    );
  }

  if (credential.status === "revoked") {
    const label = t("cred.audit.revokedBy");
    const userId = credential.revoker_user_id;

    const personContent = (!userId && !credential.revoker) ? (
      <div className="min-w-0">
        <EyebrowLabel as="span" className="mb-1 block text-error">
          {label}
        </EyebrowLabel>
        <p className="text-sm text-gray-500">—</p>
      </div>
    ) : (
      <PersonRow
        user={credential.revoker}
        userId={userId ?? ""}
        subline={credential.revoker?.number ?? undefined}
        blockLinks={blockLinks}
        label={label}
        tone="error"
      />
    );

    return (
      <div className="space-y-3">
        {personContent}
        {credential.revocation_reason && (
          <div className="rounded-md bg-error/10 p-2.5 text-xs text-error">
            <span className="font-semibold">{t("cred.revoke.modal.reasonLabel")}: </span>
            <span className="line-clamp-2">{credential.revocation_reason}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
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
  hideHolder,
  showActor,
  holderUnitName,
  onOpenDetail,
}: CredentialCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);

  const isRevoked = credential.status === "revoked";
  const canInlineReview = canReview && !selectionMode && credential.status === "pending";
  const hasUnresolvedMetadata = (credential.unresolved_metadata?.length ?? 0) > 0;
  const competencies = [
    ...(credential.competencies ?? []).map((c) => ({ name: c.name, staged: false })),
    ...(credential.submitted_competencies ?? [])
      .filter((c) => c.resolved_id === null)
      .map((c) => ({ name: c.name, staged: true })),
  ];
  if (competencies.length === 0 && credential.meta) {
    const raw = credential.meta.competencies || credential.meta.competency;
    if (Array.isArray(raw)) {
      raw.forEach((c) => {
        if (typeof c === "string" && c.trim()) competencies.push({ name: c.trim(), staged: true });
      });
    } else if (typeof raw === "string" && raw.trim()) {
      competencies.push({ name: raw.trim(), staged: true });
    }
  }
  const showCompetencies = competencies.length > 0;

  const hideHolderEffective = hideHolder ?? showActor;
  const showHolder = !isHolder && !hideHolderEffective;
  const showAuditStrip = credential.status !== "pending";
  const showFooter = showAuditStrip || canInlineReview;

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

  const openDetail = () => {
    if (onOpenDetail) {
      onOpenDetail(credential.id);
    } else {
      navigate(`/credentials?credential_id=${credential.id}`);
    }
  };

  const handleCompleteDetailsClick = (e: React.MouseEvent) => {
    stop(e);
    openDetail();
  };

  const isSubmission = Boolean(
    credential.submitter_user_id && credential.submitter_user_id === credential.holder_user_id,
  );
  const isSelectable = isEligibleFor(credential, selectionMode ?? null);
  const selectBlocked = !!selectionMode && (!isSelectable || !!selectDisabled);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTORS)) return;
    if (selectionMode) {
      if (isSelectable && !selectDisabled) {
        onSelect?.();
      } else if (!isSelectable) {
        if (selectionMode === "revoke") {
          if (credential.status === "expired") {
            notify.info("cred.card.alreadyExpired");
          } else {
            notify.info("cred.card.alreadyRevoked");
          }
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
    openDetail();
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (selectionMode) {
      if (isSelectable && !selectDisabled) onSelect?.();
      return;
    }
    openDetail();
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
        STATUS_SURFACE[credential.status],
      )}
      aria-label={t(getCredentialStatusLabelKey(credential.status, isSubmission))}
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
        {/* Top bar: Status Badge + Lifecycle / Primary Date */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <CredentialStatusBadge status={credential.status} isSubmission={isSubmission} />
          <div className="text-xs text-gray-500">
            <div className="space-y-0.5">
              {lifecycleDateLines(credential).map((line) => (
                <div
                  key={line.labelKey}
                  className={cn(
                    "flex items-center gap-1.5",
                    line.tone === "error"
                      ? "text-error"
                      : line.tone === "amber"
                        ? "text-amber-800"
                        : "",
                  )}
                >
                  <Calendar
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      line.tone === "error"
                        ? ""
                        : line.tone === "amber"
                          ? "text-amber-700"
                          : "text-gray-400",
                    )}
                    aria-hidden="true"
                  />
                  <span>
                    {t(line.labelKey)} {formatDate(line.timestamp, i18n.language)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="mb-2 wrap-anywhere">
            <CredentialExtractNote
              state={credential.extract_state}
              error={credential.extract_error}
            />
          </div>
        )}

        {/* Identity Band: Name, Type, Issuing Organization */}
        <h3
          className={cn(
            "mb-3 line-clamp-2 font-sans text-lg font-bold wrap-break-word",
            isRevoked ? "text-gray-500" : "text-navy",
          )}
        >
          {selectionMode ? (
            <button
              type="button"
              className="rounded text-left hover:underline focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openDetail();
              }}
            >
              {credential.name}
            </button>
          ) : (
            credential.name
          )}
        </h3>

        <div className="mb-3 min-w-0">
          <EyebrowLabel as="span" className="mb-1 block">
            {t("cred.submit.field.type")}
          </EyebrowLabel>
          <StagedValue resolved={credential.type?.name} staged={credential.submitted_type_name} />
        </div>

        <div className="mb-3 min-w-0">
          <EyebrowLabel as="span" className="mb-1 block">
            {t("cred.parties.issuerOrganization")}
          </EyebrowLabel>
          <StagedValue
            resolved={credential.issuer_organization?.name}
            staged={credential.submitted_issuer_organization_name}
          />
        </div>

        {/* Substance Band: Holder, Competencies */}
        {showHolder && (
          <div className="mb-3 min-w-0">
            <PersonRow
              user={credential.holder}
              userId={credential.holder_user_id}
              subline={
                [credential.holder?.number, holderUnitName].filter(Boolean).join(" · ") || undefined
              }
              blockLinks={blockLinks || !credential.holder_user_id}
              label={t("cred.detail.holder")}
            />
          </div>
        )}

        {showCompetencies && (
          <div className="mb-3 min-w-0">
            <EyebrowLabel as="span" className="mb-1 block">
              {t("cred.competency.title")}
            </EyebrowLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {competencies.slice(0, 2).map((comp, idx) => (
                <Badge
                  key={`${comp.name}-${idx}`}
                  tone={comp.staged ? "gray" : "gold"}
                  icon={comp.staged ? CircleDashed : undefined}
                  className="max-w-full truncate"
                >
                  {comp.name}
                </Badge>
              ))}
              {competencies.length > 2 && (
                <span className="shrink-0 text-xs font-medium text-gray-500">
                  {t("cred.card.competencyOverflow", { count: competencies.length - 2 })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Audit Band / Actions Footer */}
        {showFooter && (
          <div className="mt-auto pt-4">
            <div
              className={cn(
                "space-y-3 border-t pt-3",
                credential.status === "rejected"
                  ? "border-error/20"
                  : credential.status === "revoked"
                    ? "border-gray-200"
                    : "border-gray-100",
              )}
            >
              {showAuditStrip && <AuditStrip credential={credential} blockLinks={blockLinks} />}

              {canInlineReview && (
                <div>
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRejectToggle}
                      >
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
                        <Textarea
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
          </div>
        )}
      </div>
    </Card>
  );
}
