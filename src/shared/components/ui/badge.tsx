import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@shared/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider",
  {
    variants: {
      tone: {
        navy: "bg-navy/10 text-navy",
        gold: "bg-gold/20 text-navy",
        error: "bg-error/10 text-error",
        green: "bg-green-100 text-green-700",
        gray: "bg-gray-100 text-gray-600",
      },
    },
    defaultVariants: { tone: "navy" },
  },
);

export type StatusTone = "navy" | "gold" | "error" | "green" | "gray";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: LucideIcon;
}

export function Badge({ className, tone, icon: Icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {Icon && <Icon className="mr-1 h-3 w-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}
