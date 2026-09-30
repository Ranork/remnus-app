import * as React from "react"
import { cn } from "@/lib/cn"

// Text fields in the R8 language: a raised well with a line edge; focus turns the edge
// to the focus colour instead of adding a second ring (so it lines up with Select).
const fieldClass =
  "w-full min-w-0 rounded-control border border-line bg-raised text-fg placeholder:text-fg-4 transition-colors outline-none hover:border-line-strong focus-visible:border-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500"

function Input({
  className,
  size = "default",
  type = "text",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & { size?: "sm" | "default" | "lg" }) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        fieldClass,
        size === "sm" ? "h-7 px-2 text-xs" : size === "lg" ? "h-10 px-3 text-sm" : "h-8 px-2.5 text-ui",
        className
      )}
      {...props}
    />
  )
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, "min-h-20 resize-y px-2.5 py-2 text-ui leading-relaxed", className)}
      {...props}
    />
  )
}

export { Input, Textarea, fieldClass }
