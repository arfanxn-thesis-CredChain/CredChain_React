import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Copy } from "lucide-react";
import { Button } from "@ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/dialog";
import { FormField } from "@ui/form-field";
import { Textarea } from "@ui/textarea";
import { PersonRow } from "@shared/components/CredentialCard";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import { StagedValue } from "@shared/components/StagedValue";
import { formatDate } from "@shared/lib/format";
import type { UserDTO } from "@shared/types/api";

export interface CredentialRevokeItem {
  id: string;
  name: string;
  holder?: UserDTO | null;
  holderNumber?: string | null;
  holderUnitName?: string | null;
  typeName?: string | null;
  submittedTypeName?: string | null;
  orgName?: string | null;
  submittedOrgName?: string | null;
  submittedAt?: string | null;
}

export interface CredentialRevokeReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CredentialRevokeItem[];
  onSubmit: (revocations: { id: string; reason: string }[]) => void;
  isSubmitting?: boolean;
  onOpenDetail?: (id: string) => void;
}

const MAX_REASON_LENGTH = 1000;

export function CredentialRevokeReasonModal({
  open,
  onOpenChange,
  items,
  onSubmit,
  isSubmitting = false,
  onOpenDetail,
}: CredentialRevokeReasonModalProps) {
  const { t, i18n } = useTranslation();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);

  // Reset per-row reasons each time the dialog opens (items may change between selections).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setReasons({});
      setAttempted(false);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setReason = (id: string, value: string) => {
    setReasons((prev) => ({ ...prev, [id]: value }));
  };

  const firstReason = items[0] ? (reasons[items[0].id] ?? "") : "";

  const applyToAll = () => {
    if (!firstReason.trim()) return;
    setReasons(
      items.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = firstReason;
        return acc;
      }, {}),
    );
  };

  const reasonFor = (id: string) => reasons[id] ?? "";

  const errorFor = (id: string): string | undefined => {
    if (!attempted) return undefined;
    const value = reasonFor(id);
    if (value.length > MAX_REASON_LENGTH) return t("cred.revoke.modal.reasonTooLong");
    return undefined;
  };

  const isValid = (id: string) => {
    const value = reasonFor(id);
    return value.length <= MAX_REASON_LENGTH;
  };

  const allValid = items.every((item) => isValid(item.id));

  const handleSubmit = () => {
    setAttempted(true);
    if (!allValid) return;
    onSubmit(items.map((item) => ({ id: item.id, reason: reasonFor(item.id).trim() })));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl sm:max-w-5xl p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle>{t("cred.revoke.modal.title")}</DialogTitle>
          <DialogDescription>{t("cred.revoke.modal.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {items.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyToAll}
              disabled={!firstReason.trim() || isSubmitting}
            >
              <Copy className="h-4 w-4" />
              {t("cred.revoke.modal.applyToAll")}
            </Button>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="space-y-3 rounded-2xl border border-gray-100 p-4"
            >
              <button
                type="button"
                className="text-left font-sans text-base font-bold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded wrap-break-word"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.(item.id);
                }}
              >
                {item.name}
              </button>

              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                {/* Row 1, Col 1: HOLDER */}
                <div className="min-w-0">
                  {item.holder ? (
                    <PersonRow
                      user={item.holder}
                      userId={item.holder.id}
                      subline={
                        [item.holderNumber, item.holderUnitName]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                      blockLinks={true}
                      label={t("cred.detail.holder")}
                    />
                  ) : (
                    <div>
                      <EyebrowLabel as="span" className="mb-1 block">
                        {t("cred.detail.holder")}
                      </EyebrowLabel>
                      <p className="text-sm text-gray-500">—</p>
                    </div>
                  )}
                </div>

                {/* Row 1, Col 2: TYPE */}
                <div className="min-w-0">
                  <EyebrowLabel as="span" className="mb-1 block">
                    {t("cred.submit.field.type")}
                  </EyebrowLabel>
                  <StagedValue
                    resolved={item.typeName}
                    staged={item.submittedTypeName}
                  />
                </div>

                {/* Row 2, Col 1: SUBMITTED */}
                <div className="min-w-0">
                  <EyebrowLabel as="span" className="mb-1 block">
                    {t("cred.card.submitted")}
                  </EyebrowLabel>
                  {item.submittedAt ? (
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                      <Calendar
                        className="h-3.5 w-3.5 shrink-0 text-gray-400"
                        aria-hidden="true"
                      />
                      <span>{formatDate(item.submittedAt, i18n.language)}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>

                {/* Row 2, Col 2: ORGANIZATION */}
                <div className="min-w-0">
                  <EyebrowLabel as="span" className="mb-1 block">
                    {t("cred.parties.issuerOrganization")}
                  </EyebrowLabel>
                  <StagedValue
                    resolved={item.orgName}
                    staged={item.submittedOrgName}
                  />
                </div>
              </div>

              <div className="pt-2">
                <FormField
                  label={t("cred.revoke.modal.reasonLabel")}
                  error={errorFor(item.id)}
                >
                  <Textarea
                    value={reasonFor(item.id)}
                    onChange={(e) => setReason(item.id, e.target.value)}
                    maxLength={MAX_REASON_LENGTH}
                    placeholder={t("cred.revoke.modal.reasonPlaceholder")}
                    aria-label={t("cred.revoke.modal.reasonLabel")}
                    aria-invalid={Boolean(errorFor(item.id))}
                  />
                </FormField>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("cred.revoke.modal.submitting") : t("cred.revoke.modal.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
