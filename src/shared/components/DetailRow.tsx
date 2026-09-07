import type { LucideIcon } from "lucide-react";
import { cn } from "@shared/lib/cn";

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "error";
  className?: string;
}

export function DetailRow({
  label,
  value,
  icon: Icon,
  tone = "default",
  className,
}: DetailRowProps) {
  const isError = tone === "error";
  return (
    <div className={className}>
      <dt
        className={cn(
          "mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase",
          isError ? "text-error" : "text-gray-500",
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </dt>
      <dd className={cn("text-sm", isError ? "text-error" : "text-navy")}>{value}</dd>
    </div>
  );
}
