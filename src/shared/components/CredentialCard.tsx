import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Calendar } from "lucide-react";
import { cn } from "@shared/lib/cn";
import { MonoId } from "@shared/components/MonoId";
import { formatDate } from "@shared/lib/format";
import { Card } from "@ui/card";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { notify } from "@shared/lib/notify";
import { UserContactBlock } from "@shared/components/UserContactBlock";
import type { CredentialDTO } from "@shared/types/api";
import { CredentialStatusBadge } from "./CredentialStatusBadge";

interface CredentialCardProps {
  credential: CredentialDTO;
  isSelected?: boolean;
  selectionMode?: "revoke" | "reextract" | "approve" | "reject" | null;
  onSelect?: () => void;
  selectDisabled?: boolean;
  blockLinks?: boolean;
  statusBadge?: React.ReactNode;
}

const INTERACTIVE_SELECTORS = "a,button,[role='button'],input,textarea,select";

export function CredentialCard({
  credential,
  isSelected,
  selectionMode,
  onSelect,
  selectDisabled,
  blockLinks,
  statusBadge,
}: CredentialCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const revoked = credential.revoked_at !== null;

  const isSelectable =
    selectionMode === "revoke"
      ? !revoked
      : selectionMode === "reextract"
        ? credential.extract_status === "failed"
        : selectionMode === "approve" || selectionMode === "reject"
          ? credential.lifecycle_status === "pending"
          : false;

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
            credential.extract_status === "succeeded"
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
        "relative cursor-pointer p-5 transition-all focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
        selectDisabled && "cursor-not-allowed",
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
          disabled={!isSelectable || selectDisabled}
          className={cn(
            "absolute top-4 right-4 z-10 h-5 w-5 rounded border-2 transition-colors",
            "focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
            (!isSelectable || selectDisabled) && "cursor-not-allowed opacity-30",
            isSelected ? "border-gold bg-gold" : "border-gray-300 hover:border-gold",
          )}
          aria-pressed={isSelected}
          aria-label={isSelected ? t("cred.card.deselect") : t("cred.card.select")}
        />
      )}

      <div className="pr-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {statusBadge}
          <CredentialStatusBadge revoked={revoked} />
          {credential.extract_status !== "succeeded" && (
            <CredentialStatusBadge
              revoked={false}
              extractStatus={credential.extract_status}
              showExtractStatus
            />
          )}
        </div>

        <div className="mb-4">
          <h3 className="line-clamp-2 font-sans font-bold text-base text-navy">
            {credential.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-1">
            <MonoId value={credential.id} mode="id" />
            <CopyInlineButton
              value={credential.id}
              ariaLabel={t("cred.copy.credentialId")}
              className="shrink-0"
            />
          </div>
        </div>

        <div className="space-y-3">
          <UserContactBlock
            labelType="full"
            user={credential.holder}
            fallbackId={credential.holder_user_id}
            copyPrefix="holder"
            blockLinks={blockLinks || !!selectionMode}
          />

          <UserContactBlock
            labelType="compact"
            user={credential.issuer}
            fallbackId={credential.issuer_user_id}
            copyPrefix="issuer"
            blockLinks={blockLinks || !!selectionMode}
          />

          {revoked && credential.revoker && (
            <UserContactBlock
              labelType="compact"
              user={credential.revoker}
              fallbackId={credential.revoker_user_id ?? ""}
              copyPrefix="revoker"
              tone="error"
              blockLinks={blockLinks || !!selectionMode}
            />
          )}
        </div>

        <div className="mt-4 space-y-1 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            <span>
              {t("cred.card.issued")} {formatDate(credential.issued_at)}
            </span>
          </div>
          {credential.revoked_at && (
            <div className="flex items-center gap-1.5 text-error">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {t("cred.card.revoked")} {formatDate(credential.revoked_at)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
