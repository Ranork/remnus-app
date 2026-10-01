import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

// Small status/count labels. Sentence case, never uppercase (CSS `uppercase` turns
// "Title" into "TİTLE" under lang="tr"). `signal` is the one accent — use it for what is
// live or new; `count` is the red unread dot-with-number; success / warning / danger are
// semantic only (a state, never decoration).
const badgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-full font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        neutral: "bg-raised text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)]",
        outline: "text-fg-3 shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
        signal: "bg-signal-soft text-signal-text",
        solid: "bg-signal text-signal-fg",
        success: "bg-green-500/15 text-green-400",
        warning: "bg-amber-500/15 text-amber-400",
        danger: "bg-red-500/15 text-red-400",
        count: "min-w-4 bg-red-500 px-1 text-white font-semibold tabular-nums",
      },
      size: {
        sm: "h-4 px-1.5 text-2xs leading-none",
        default: "h-5 px-2 text-2xs",
      },
    },
    compoundVariants: [{ variant: "count", size: "default", className: "px-1.5" }],
    defaultVariants: { variant: "neutral", size: "default" },
  }
)

function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

export { Badge, badgeVariants }
