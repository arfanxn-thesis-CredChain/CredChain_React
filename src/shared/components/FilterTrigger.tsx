import { forwardRef, type ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@shared/lib/cn";
import { Button } from "@ui/button";

interface FilterTriggerProps extends ComponentProps<typeof Button> {
  /** When true, styles the pill with the on-brand gold cue to signal an applied filter. */
  active?: boolean;
}

/**
 * Shared trigger pill for filter/sort dropdown menus. Renders an outline button
 * with a trailing chevron and an optional active-state gold accent, so every
 * filter bar looks consistent and applied filters are visible at a glance.
 */
export const FilterTrigger = forwardRef<HTMLButtonElement, FilterTriggerProps>(
  ({ active, className, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      className={cn("rounded-lg", active && "border-gold bg-gold/10 text-navy", className)}
      {...props}
    >
      {children}
      <ChevronDown className="ml-1 h-3 w-3 text-gray-400" aria-hidden="true" />
    </Button>
  ),
);
FilterTrigger.displayName = "FilterTrigger";
