import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil } from "lucide-react";
import { cn } from "@shared/lib/cn";
import { DetailRow } from "@shared/components/DetailRow";
import { FormField } from "@ui/form-field";
import { Button } from "@ui/button";

export interface DetailField {
  key: string;
  label: string;
  readValue: ReactNode;
  editControl: ReactNode;
  error?: string;
  fullWidth?: boolean;
}

interface DetailEditFormProps {
  title?: string;
  fields: DetailField[];
  canEdit?: boolean;
  editDisabledReason?: string;
  onSave: () => Promise<boolean>;
  onCancel?: () => void;
  isSaving: boolean;
  className?: string;
}

export function DetailEditForm({
  title,
  fields,
  canEdit = true,
  editDisabledReason,
  onSave,
  onCancel,
  isSaving,
  className,
}: DetailEditFormProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const isEditable = editing && canEdit;

  const handleSave = async () => {
    try {
      const ok = await onSave();
      if (ok) setEditing(false);
    } catch {
      // Stay in edit mode so the caller's form values survive a failed save.
    }
  };

  const handleCancel = () => {
    onCancel?.();
    setEditing(false);
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <h3 className="font-sans text-lg font-bold text-navy">{title}</h3>}
          {!canEdit && editDisabledReason && (
            <p className="mt-1 text-xs text-gray-500">{editDisabledReason}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isEditable && canEdit && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </Button>
          )}
          {isEditable && (
            <>
              <Button variant="gold" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                {t("common.cancel")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        {isEditable ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className={cn(field.fullWidth && "sm:col-span-2")}>
                <FormField label={field.label} error={field.error}>
                  {field.editControl}
                </FormField>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className={cn(field.fullWidth && "sm:col-span-2")}>
                <DetailRow label={field.label} value={field.readValue} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
