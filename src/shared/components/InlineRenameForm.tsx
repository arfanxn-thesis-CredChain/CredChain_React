import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@ui/button";
import { Input } from "@ui/input";

export interface InlineRenameFormProps {
  initialValue: string;
  isPending?: boolean;
  error?: string | null;
  submitLabel?: string;
  inputAriaLabel?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/**
 * Inline edit/rename form matching the pattern and visual style in UserUnitTree:
 * compact input, submit button with loader, and ghost cancel button.
 */
export function InlineRenameForm({
  initialValue,
  isPending = false,
  error,
  submitLabel,
  inputAriaLabel,
  onSubmit,
  onCancel,
}: InlineRenameFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValue);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = error ?? localError;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("zod.name.required");
      return;
    }
    setLocalError(null);
    onSubmit(trimmed);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* flex-1 on the wrapper: Input forwards className to
            the inner <input>, not to this flex child. */}
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Input
            size="compact"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (localError) setLocalError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancel();
            }}
            autoFocus
            aria-label={inputAriaLabel ?? t("common.edit")}
            maxLength={256}
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          {submitLabel ?? t("common.save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="shrink-0"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
      </form>
      {displayError && (
        <p role="alert" className="mt-1 text-xs text-error">
          {t(displayError)}
        </p>
      )}
    </div>
  );
}
