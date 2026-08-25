import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@shared/lib/cn";

// Omit the native `size` (a number, the character-width hint) so the prop can
// carry the height token instead. Nothing in the app used the native one.
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  leadingIcon?: LucideIcon;
  trailingAction?: React.ReactNode;
  size?: "compact" | "default";
}

// Matches the Button size scale so an input and the button beside it line up
// without either call site hand-tuning a height.
const inputSizes = {
  compact: "h-9 text-xs", // pairs with Button size="sm"
  default: "h-11 text-sm", // pairs with Button size="md"
} as const;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { leadingIcon: Icon, trailingAction, className, type = "text", size = "default", ...props },
    ref,
  ) => (
    <div className="relative">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
      )}
      <input
        ref={ref}
        type={type}
        className={cn(
          "block w-full rounded-xl border border-gray-200 pr-3 shadow-sm",
          "bg-gray-50 text-navy placeholder-gray-400",
          inputSizes[size],
          "focus:border-transparent focus:bg-white focus:ring-2 focus:ring-gold focus:outline-none",
          "transition-all",
          "disabled:cursor-not-allowed disabled:opacity-60",
          Icon ? "pl-10" : "pl-4",
          trailingAction && "pr-10",
          className,
        )}
        {...props}
      />
      {trailingAction && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">{trailingAction}</div>
      )}
    </div>
  ),
);
Input.displayName = "Input";
