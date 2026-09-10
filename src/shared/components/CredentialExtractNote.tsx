import { useTranslation } from "react-i18next";
import { AlertTriangle, CircleDashed, FileQuestion, type LucideIcon } from "lucide-react";
import { cn } from "@shared/lib/cn";
import type { ExtractState } from "@shared/types/api";

interface CredentialExtractNoteProps {
  state: ExtractState;
  error?: string | null;
  className?: string;
}

const ICON_MAP: Record<ExtractState, LucideIcon | null> = {
  unextracted: FileQuestion,
  pending: CircleDashed,
  failed: AlertTriangle,
  succeeded: null,
};

const LABEL_KEY: Record<ExtractState, string> = {
  unextracted: "cred.extract.unextracted",
  pending: "cred.extract.pendingExtraction",
  failed: "cred.extract.failed",
  succeeded: "",
};

export function CredentialExtractNote({ state, error, className }: CredentialExtractNoteProps) {
  const { t } = useTranslation();

  if (state === "succeeded") {
    return null;
  }

  const Icon = ICON_MAP[state];
  const isFailed = state === "failed";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs",
        isFailed ? "text-error" : "text-gray-500",
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>
        {t(LABEL_KEY[state])}
        {isFailed && error ? `: ${error}` : ""}
      </span>
    </div>
  );
}
