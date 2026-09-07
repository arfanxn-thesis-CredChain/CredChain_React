import { cn } from "@shared/lib/cn";

type EyebrowTone = "muted" | "navy";

interface EyebrowLabelProps {
  children: React.ReactNode;
  tone?: EyebrowTone;
  className?: string;
  as?: "dt" | "p" | "span" | "div";
}

export function EyebrowLabel({
  children,
  tone = "muted",
  className,
  as: Tag = "dt",
}: EyebrowLabelProps) {
  return (
    <Tag
      className={cn(
        "mb-1 text-xs font-bold tracking-wider uppercase",
        tone === "navy" ? "text-navy" : "text-gray-500",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
