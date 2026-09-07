import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Ban, CheckCircle2, Loader2, RotateCw, XCircle } from "lucide-react";
import { Button } from "@ui/button";
import { FormField } from "@ui/form-field";
import { Input } from "@ui/input";
import { CredentialStatusBadge } from "@shared/components/CredentialStatusBadge";
import { CredentialExtractNote } from "@shared/components/CredentialExtractNote";
import { CredentialViewFilePreview } from "./CredentialViewFilePreview";
import type { CredentialDTO } from "@shared/types/api";

interface CredentialHeroCardProps {
  credential: CredentialDTO;
  canManage: boolean;
  isReExtracting: boolean;
  isApproving: boolean;
  isRevoking: boolean;
  isRejecting: boolean;
  onReExtract: () => void;
  onApprove: () => void;
  onReject: (rejections: { id: string; reason: string }[]) => void;
  onRevoke: () => void;
}

/**
 * Card 1: what the artifact is and whether it's usable right now. File
 * preview + lifecycle/extract status + ULID on top; the review action bar
 * (Issuer+ only) below a hairline. No credential name here — PageHeader
 * already renders it once as the page <h1>; repeating it here was the most
 * visible duplication in the pre-redesign layout.
 */
export function CredentialHeroCard({
  credential: cred,
  canManage,
  isReExtracting,
  isApproving,
  isRevoking,
  isRejecting,
  onReExtract,
  onApprove,
  onReject,
  onRevoke,
}: CredentialHeroCardProps) {
  const { t } = useTranslation();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);

  const isPendingReview = cred.status === "pending";
  const extractFailed = cred.extract_state === "failed";
  const hasUnresolvedMetadata = (cred.unresolved_metadata?.length ?? 0) > 0;
  const hasFileUri = cred.file_uri != null;

  const handleRejectToggle = () => {
    setRejectOpen((v) => !v);
    setReason("");
    setReasonMissing(false);
  };

  const handleRejectConfirm = () => {
    if (!reason.trim()) {
      setReasonMissing(true);
      return;
    }
    onReject([{ id: cred.id, reason: reason.trim() }]);
  };

  const statusBadges = (
    <div className="flex flex-wrap items-center gap-3">
      <CredentialStatusBadge status={cred.status} />
      {canManage && (
        <CredentialExtractNote
          state={cred.extract_state}
          error={cred.extract_error}
        />
      )}
    </div>
  );

  return (
    <div className="relative z-10 space-y-6">
      {hasFileUri ? (
        <CredentialViewFilePreview
          credentialId={cred.id}
          credentialName={cred.name}
          hasFileUri={true}
          statusSlot={statusBadges}
        />
      ) : (
        statusBadges
      )}

      {canManage && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-6">
          {isPendingReview && hasUnresolvedMetadata && (
            <p className="mr-auto text-xs text-gold-text" role="status">
              {t("cred.metadata.blocksApproval")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {extractFailed && (
              <Button variant="outline" onClick={onReExtract} disabled={isReExtracting}>
                <RotateCw className="h-4 w-4" />
                {isReExtracting ? t("cred.issue.submitting") : t("cred.detail.reExtract")}
              </Button>
            )}
            {isPendingReview &&
              (!rejectOpen ? (
                <>
                  <Button
                    variant="gold"
                    onClick={onApprove}
                    disabled={isApproving || hasUnresolvedMetadata}
                    title={hasUnresolvedMetadata ? t("cred.metadata.blocksApproval") : undefined}
                  >
                    {isApproving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {t("cred.detail.approve")}
                  </Button>
                  <Button variant="outline" onClick={handleRejectToggle}>
                    <XCircle className="h-4 w-4" />
                    {t("cred.detail.reject")}
                  </Button>
                </>
              ) : (
                <div className="flex min-w-[240px] flex-1 flex-wrap items-end gap-2">
                  <div className="min-w-[240px] flex-1">
                    <FormField
                      label={t("cred.reject.modal.reasonLabel")}
                      error={reasonMissing ? "cred.reject.modal.reasonRequired" : undefined}
                    >
                      <Input
                        value={reason}
                        onChange={(e) => {
                          setReason(e.target.value);
                          setReasonMissing(false);
                        }}
                        maxLength={1000}
                        placeholder={t("cred.reject.modal.reasonPlaceholder")}
                        aria-label={t("cred.reject.modal.reasonLabel")}
                      />
                    </FormField>
                  </div>
                  <Button variant="outline" onClick={handleRejectToggle} disabled={isRejecting}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRejectConfirm}
                    disabled={isRejecting}
                  >
                    {isRejecting ? t("cred.reject.modal.submitting") : t("cred.reject.modal.submit")}
                  </Button>
                </div>
              ))}
            {!isPendingReview && (
              <Button variant="destructive" onClick={onRevoke} disabled={isRevoking}>
                {isRevoking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                {t("cred.revoke.confirmAction")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
