import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
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
import { Input } from "@ui/input";

export interface CredentialRejectItem {
  id: string;
  name: string;
}

export interface CredentialRejectReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CredentialRejectItem[];
  onSubmit: (rejections: { id: string; reason: string }[]) => void;
  isSubmitting?: boolean;
}

const MAX_REASON_LENGTH = 1000;

export function CredentialRejectReasonModal({
  open,
  onOpenChange,
  items,
  onSubmit,
  isSubmitting = false,
}: CredentialRejectReasonModalProps) {
  const { t } = useTranslation();
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
    if (!value.trim()) return t("cred.reject.modal.reasonRequired");
    if (value.length > MAX_REASON_LENGTH) return t("cred.reject.modal.reasonTooLong");
    return undefined;
  };

  const isValid = (id: string) => {
    const value = reasonFor(id);
    return value.trim().length > 0 && value.length <= MAX_REASON_LENGTH;
  };

  const allValid = items.every((item) => isValid(item.id));

  const handleSubmit = () => {
    setAttempted(true);
    if (!allValid) return;
    onSubmit(items.map((item) => ({ id: item.id, reason: reasonFor(item.id).trim() })));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("cred.reject.modal.title")}</DialogTitle>
          <DialogDescription>{t("cred.reject.modal.description")}</DialogDescription>
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
              {t("cred.reject.modal.applyToAll")}
            </Button>
          )}

          {items.map((item) => (
            <FormField key={item.id} label={item.name} error={errorFor(item.id)}>
              <Input
                value={reasonFor(item.id)}
                onChange={(e) => setReason(item.id, e.target.value)}
                maxLength={MAX_REASON_LENGTH}
                placeholder={t("cred.reject.modal.reasonPlaceholder")}
                aria-label={t("cred.reject.modal.reasonLabel")}
                aria-invalid={Boolean(errorFor(item.id))}
              />
            </FormField>
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
            {isSubmitting ? t("cred.reject.modal.submitting") : t("cred.reject.modal.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
