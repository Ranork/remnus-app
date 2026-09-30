import * as React from "react"
import { cn } from "@/lib/cn"

/** A key or key combination, e.g. <Kbd>Ctrl</Kbd><Kbd>K</Kbd>. Monospace is right here:
 *  it is literally what the keyboard says. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-raised px-1 font-mono text-2xs leading-none font-medium text-fg-3 shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
