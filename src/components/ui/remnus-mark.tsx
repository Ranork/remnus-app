import * as React from "react"
import { cn } from "@/lib/cn"

/**
 * The Remnus "R" as a single path in `currentColor`, so it takes the text colour of
 * whatever theme it sits in (the PNG app icon carries its own dark square, which read
 * as a dark tile on the light theme). Traced from public/logo-square-dark.png.
 */
function RemnusMark({ className, title, ...props }: React.ComponentProps<"svg"> & { title?: string }) {
  return (
    <svg
      viewBox="40 70 432 370"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title && <title>{title}</title>}
      <polygon
        fill="currentColor"
        points="90,88 355,88 422,168 330,268 455,420 318,420 210,300 104,420 55,420 272,175 178,175 90,268"
      />
    </svg>
  )
}

export { RemnusMark }
