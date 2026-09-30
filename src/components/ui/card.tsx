import * as React from "react"
import { cn } from "@/lib/cn"

// A card is a small sheet. `on="desk"` (default) lifts it off the desk like the content
// sheet (dashboard blocks); `on="sheet"` is a raised panel inside the sheet (a settings
// group, a stat) — a line edge, no drop shadow, so a page of them stays calm.
// Use a card only for content that IS a separate object; a list of rows is not cards.

function Card({
  className,
  on = "desk",
  ...props
}: React.ComponentProps<"div"> & { on?: "desk" | "sheet" }) {
  return (
    <div
      data-slot="card"
      data-on={on}
      className={cn(
        "flex min-w-0 flex-col rounded-surface text-fg-2",
        on === "desk" ? "bg-sheet shadow-sheet" : "bg-raised shadow-[inset_0_0_0_1px_var(--color-line)]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex items-start gap-3 px-5 pt-4 pb-3", className)} {...props} />
}

/** The card's label. A sentence-case caption, not an uppercase eyebrow. */
function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("min-w-0 flex-1 text-ui font-medium text-fg-3", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-xs leading-relaxed text-fg-3", className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("-my-1 ml-auto flex shrink-0 items-center gap-1", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("min-w-0 flex-1 px-5 pb-5", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 border-t border-line px-5 py-3", className)}
      {...props}
    />
  )
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
