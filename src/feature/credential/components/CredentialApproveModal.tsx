import { useTranslation } from "react-i18next";
import { Calendar, Loader2 } from "lucide-react";
import { Button } from "@ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/dialog";
import { PersonRow } from "@shared/components/CredentialCard";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import { StagedValue } from "@shared/components/StagedValue";
import { formatDate } from "@shared/lib/format";
import type { CredentialDTO } from "@shared/types/api";

interface CredentialApproveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CredentialDTO[];
  selectionChanged?: boolean;
  unitNames: Map<string, string>;
  onConfirm: () => void;
  isSubmitting: boolean;
  onOpenDetail?: (id: string) => void;
}

export function CredentialApproveModal({
  open,
  onOpenChange,
  items,
  selectionChanged,
  unitNames,
  onConfirm,
  isSubmitting,
  onOpenDetail,
}: CredentialApproveModalProps) {
  const { t, i18n } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-w-5xl p-6 sm:max-w-5xl sm:p-8">
        <DialogHeader>
          <DialogTitle>{t("cred.approve.modal.title", { count: items.length })}</DialogTitle>
          <DialogDescription>{t("cred.approve.modal.description")}</DialogDescription>
          {selectionChanged && (
            <p role="status" className="text-sm font-medium text-error">
              {t("cred.card.selectionChanged")}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="space-y-3 rounded-2xl border border-gray-100 p-4">
              <button
                type="button"
                className="rounded text-left font-sans font-bold wrap-break-word text-base text-navy hover:underline focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                onClick={() => onOpenDetail?.(item.id)}
              >
                {item.name}
              </button>

              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <div className="min-w-0">
                  {item.holder ? (
                    <PersonRow
                      user={item.holder}
                      userId={item.holder.id}
                      subline={
                        [
                          item.holder.number,
                          item.holder.unit_id && unitNames.get(item.holder.unit_id),
                        ]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                      blockLinks
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

                <div className="min-w-0">
                  <EyebrowLabel as="span" className="mb-1 block">
                    {t("cred.submit.field.type")}
                  </EyebrowLabel>
                  <StagedValue resolved={item.type?.name} staged={item.submitted_type_name} />
                </div>

                <div className="min-w-0">
                  <EyebrowLabel as="span" className="mb-1 block">
                    {t("cred.card.submitted")}
                  </EyebrowLabel>
                  {item.created_at ? (
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                      <span>{formatDate(item.created_at, i18n.language)}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>

                <div className="min-w-0">
                  <EyebrowLabel as="span" className="mb-1 block">
                    {t("cred.parties.issuerOrganization")}
                  </EyebrowLabel>
                  <StagedValue
                    resolved={item.issuer_organization?.name}
                    staged={item.submitted_issuer_organization_name}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="gold"
            onClick={onConfirm}
            disabled={isSubmitting || selectionChanged || items.length === 0}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isSubmitting ? t("cred.approve.modal.submitting") : t("cred.approve.modal.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
