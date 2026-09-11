import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleDashed } from "lucide-react";
import { cn } from "@shared/lib/cn";

export interface StagedValueProps {
  resolved?: string | null;
  staged?: string | null;
  fallback?: ReactNode;
  className?: string;
}

export function StagedValue({
  resolved,
  staged,
  fallback,
  className,
}: StagedValueProps) {
  const { t } = useTranslation();

  if (resolved) {
    return (
      <span className={cn("block truncate text-sm font-semibold text-navy", className)}>
        {resolved}
      </span>
    );
  }

  if (staged) {
    return (
      <span className={cn("flex items-center gap-1.5 text-sm text-gray-500", className)}>
        <CircleDashed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">
          {staged} · {t("cred.metadata.pending")}
        </span>
      </span>
    );
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return <span className="text-gray-500">—</span>;
}
