import * as React from "react";
import { cn } from "@shared/lib/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-navy shadow-sm placeholder-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold disabled:cursor-not-allowed disabled:opacity-60 transition-all",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
