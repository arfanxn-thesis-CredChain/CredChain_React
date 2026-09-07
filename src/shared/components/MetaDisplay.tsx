import { cn } from "@shared/lib/cn";

interface MetaDisplayProps {
  meta: Record<string, unknown> | null | undefined;
  className?: string;
}

export function MetaDisplay({ meta, className }: MetaDisplayProps) {
  if (!meta || Object.keys(meta).length === 0) {
    return <span className="text-xs text-gray-500">—</span>;
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Object.entries(meta).map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs font-semibold text-navy">{key}</span>
          <span className="min-w-0 text-xs break-all text-gray-600">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
