import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cn } from "@shared/lib/cn";
import { Button } from "@ui/button";
import { FormField } from "@ui/form-field";
import { Input } from "@ui/input";

const schema = z.object({
  name: z.string().trim().min(1, "zod.name.required").max(256, "zod.name.tooLong"),
});

interface ResourceAdminEditFormProps {
  name: string;
  active?: boolean;
  showActive?: boolean;
  nameLabel: string;
  activeLabel?: string;
  submitLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onSubmit: (values: { name: string; active: boolean }) => void;
  onCancel: () => void;
}

interface ActiveSwitchProps {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ActiveSwitch({ checked, label, disabled = false, onCheckedChange }: ActiveSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-success" : "bg-gray-200",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition-transform",
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function ResourceAdminEditForm({
  name,
  active = true,
  showActive = false,
  nameLabel,
  activeLabel,
  submitLabel,
  cancelLabel,
  isPending = false,
  onSubmit,
  onCancel,
}: ResourceAdminEditFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string }>({
    resolver: zodResolver(schema),
    defaultValues: { name },
  });
  const [activeValue, setActiveValue] = useState(active);

  const handleSubmitForm = handleSubmit((values) => onSubmit({ ...values, active: activeValue }));

  return (
    <form onSubmit={handleSubmitForm} className="space-y-4">
      <FormField label={nameLabel} error={errors.name?.message}>
        <Input autoComplete="off" autoFocus {...register("name")} />
      </FormField>
      {showActive && (
        <FormField label={activeLabel ?? t("admin.activeLabel")}>
          <ActiveSwitch
            checked={activeValue}
            label={activeLabel ?? t("admin.activeLabel")}
            disabled={isPending}
            onCheckedChange={(next) => setActiveValue(next)}
          />
        </FormField>
      )}
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {cancelLabel ?? t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitLabel ?? t("common.save")}
        </Button>
      </div>
    </form>
  );
}
