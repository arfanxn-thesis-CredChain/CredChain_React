import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@shared/lib/cn";
import { Button } from "@ui/button";
import { Input } from "@ui/input";

interface InlineCreateRowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  placeholder: string;
  submitLabel: string;
  /** Omit to render nothing when closed — the caller supplies its own trigger. */
  triggerLabel?: string;
  triggerAriaLabel?: string;
  inputAriaLabel?: string;
  isPending?: boolean;
  /** Gold marks the committing action on the reference admin pages. */
  submitVariant?: "primary" | "gold";
  className?: string;
}

/**
 * Collapsed "+ Add ..." trigger that expands into an input plus submit/cancel.
 *
 * Open state is controlled: a tree allows only one open form across all of its
 * rows and cannot enforce that against state living inside each row.
 *
 * Validation is the DOM's: maxLength caps the length and the submit button is
 * disabled while the field is blank, which is what a schema was doing here
 * before. Errors belong to the caller's mutation, so it renders them.
 */
export function InlineCreateRow({
  open,
  onOpenChange,
  triggerLabel,
  triggerAriaLabel,
  ...form
}: InlineCreateRowProps) {
  // The expanded form is a separate component so closing unmounts it and the
  // typed name dies with it. Holding that state up here would survive a close
  // the caller performs itself (on a successful save) and reappear on reopen.
  if (open) return <ExpandedForm onClose={() => onOpenChange(false)} {...form} />;
  if (!triggerLabel) return null;

  return (
    <Button
      variant="dashed"
      size="sm"
      aria-label={triggerAriaLabel}
      onClick={() => onOpenChange(true)}
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {triggerLabel}
    </Button>
  );
}

type ExpandedFormProps = Omit<
  InlineCreateRowProps,
  "open" | "onOpenChange" | "triggerLabel" | "triggerAriaLabel"
> & { onClose: () => void };

function ExpandedForm({
  onSubmit,
  onClose,
  placeholder,
  submitLabel,
  inputAriaLabel,
  isPending,
  submitVariant = "primary",
  className,
}: ExpandedFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
      }}
      className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}
    >
      {/* flex-1 belongs on this wrapper, not on Input: Input forwards className
          to the inner <input>, so passing it there leaves the actual flex child
          unsized and the row free-stretches. */}
      <div className="min-w-0 flex-1 sm:max-w-md">
        <Input
          size="compact"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
          placeholder={placeholder}
          aria-label={inputAriaLabel ?? placeholder}
          maxLength={256}
          autoComplete="off"
          autoFocus
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="submit"
          variant={submitVariant}
          size="sm"
          disabled={isPending || name.trim().length === 0}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
