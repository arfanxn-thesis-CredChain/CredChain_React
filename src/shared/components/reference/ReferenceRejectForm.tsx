import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { FormField } from "@ui/form-field";

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "cred.reject.modal.reasonRequired")
    .max(1000, "cred.reject.modal.reasonTooLong"),
});

interface ReferenceRejectFormProps {
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  isPending?: boolean;
  error?: string;
}

export function ReferenceRejectForm({
  onSubmit,
  onCancel,
  isPending = false,
  error,
}: ReferenceRejectFormProps) {
  const { t } = useTranslation();
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  });
  const disabled = isPending || isSubmitting;
  const message = errors.reason?.message ?? error;

  return (
    <form
      className="flex w-full min-w-0 flex-wrap items-start gap-2 lg:ml-auto lg:max-w-xl"
      onSubmit={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        void handleSubmit(({ reason }) => onSubmit(reason))(event);
      }}
    >
      <div className="min-w-0 flex-1 basis-48 [&_label]:sr-only">
        <FormField
          label={t("cred.references.rejectionReasonLabel")}
          htmlFor={id}
          errorId={`${id}-error`}
          error={message ? t(message, { max: 1000 }) : undefined}
        >
          <Input
            {...register("reason")}
            id={id}
            autoFocus
            size="compact"
            maxLength={1000}
            disabled={disabled}
            placeholder={t("cred.references.rejectionReasonPlaceholder")}
            aria-invalid={Boolean(message)}
            aria-describedby={message ? `${id}-error` : undefined}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !disabled) {
                event.preventDefault();
                event.stopPropagation();
                onCancel();
              }
            }}
          />
        </FormField>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={disabled}>
          {disabled && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("common.reject")}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
