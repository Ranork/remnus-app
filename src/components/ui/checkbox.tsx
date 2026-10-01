"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/cn"

// Checkbox on Base UI in the R8 language: a line-edged box that fills with the signal
// colour when ticked (the tick in signal-fg). Keyboard, `aria-checked` and the hidden
// form input come from Base UI; focus uses the app-wide :focus-visible ring.
//
//   <label className="flex items-center gap-2"><Checkbox checked={on} onCheckedChange={setOn} />Label</label>
//
// Use it where a value is on/off (a boolean property, a toggled option in a list). The
// editor's task list keeps its own drawn box (it is document content, see globals.css).

function Checkbox({
  className,
  size = "default",
  ...props
}: CheckboxPrimitive.Root.Props & { size?: "sm" | "default" }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line-strong bg-transparent text-signal-fg transition-colors outline-none hover:border-fg-4 data-checked:border-signal data-checked:bg-signal data-indeterminate:border-signal data-indeterminate:bg-signal data-disabled:cursor-not-allowed data-disabled:opacity-50",
        size === "sm" ? "size-3.5" : "size-4",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex data-unchecked:hidden">
        <CheckIcon className={size === "sm" ? "size-2.5" : "size-3"} strokeWidth={3.5} aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
