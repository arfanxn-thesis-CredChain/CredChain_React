import type { ReactNode } from "react";
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
  if (resolved) {
    return (
      <span className={cn("block text-sm font-semibold text-navy break-words", className)}>
        {resolved}
      </span>
    );
  }

  if (staged) {
    return (
      <span className={cn("flex items-start gap-1.5 text-sm text-gray-500", className)}>
        <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">
          {staged}
        </span>
      </span>
    );
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return <span className="text-gray-500">—</span>;
}
