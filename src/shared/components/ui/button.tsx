import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@shared/lib/cn";

const buttonVariants = cva(
  [
    "inline-flex justify-center items-center gap-2 font-bold transition-all rounded-xl",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none group whitespace-nowrap",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-navy text-surface shadow-md shadow-navy/20 hover:bg-navy/90 focus-visible:ring-gold",
        gold: "bg-gold text-navy shadow-md shadow-gold/20 hover:bg-gold/90 focus-visible:ring-gold",
        destructive:
          "bg-error text-surface shadow-md shadow-error/20 hover:bg-error/90 focus-visible:ring-error",
        outline:
          "border border-gray-200 bg-surface text-navy hover:bg-gray-50 focus-visible:ring-gold",
        ghost: "text-navy hover:bg-gray-100 focus-visible:ring-gold",
        link: "text-gold underline-offset-4 hover:underline focus-visible:ring-gold",
        dashed:
          "border-2 border-dashed border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 focus-visible:ring-gold",
      },
      // Heights are explicit, not a by-product of padding and line-height. A
      // button and the Input beside it must line up by construction, or every
      // row that pairs them ends up hand-patched with items-stretch/h-full.
      // Pair sm with Input size="compact" (36px) and md with "default" (44px).
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-sm",
        icon: "h-11 w-11 p-2 [&>svg]:w-5 [&>svg]:h-5",
        "icon-mobile": "h-12 w-12 p-3 [&>svg]:w-6 [&>svg]:h-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
