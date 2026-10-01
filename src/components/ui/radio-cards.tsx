"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { cn } from "@/lib/cn"

// Pick one of a few options that each need a line of explanation (what an agent may do,
// which workspace a project connects to): a stack of cards, the chosen one ringed in the
// signal colour with a filled dot. A radio group underneath — one tab stop, arrow keys
// move the choice. For a short pick-one without explanations use SegmentedControl.
//
//   <RadioCards value={scope} onValueChange={setScope} aria-label="Access">
//     <RadioCard value="read" title="Read only" description="…" badge={<Badge>Default</Badge>} />
//     <RadioCard value="write" title="Read and write" description="…" />
//   </RadioCards>
//
// The group submits nothing by itself; a form keeps its own hidden input for the value.

function RadioCards<T extends string>({
  value,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof RadioGroup>, "value" | "onValueChange" | "defaultValue"> & {
  value: T
  onValueChange: (value: T) => void
}) {
  return (
    <RadioGroup
      data-slot="radio-cards"
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function RadioCard({
  className,
  title,
  description,
  badge,
  icon,
  size = "default",
  ...props
}: Omit<React.ComponentProps<typeof Radio.Root>, "title" | "children"> & {
  title: React.ReactNode
  description?: React.ReactNode
  /** A short label beside the title, e.g. which option is the default. */
  badge?: React.ReactNode
  /** Shown between the dot and the title (a workspace icon). */
  icon?: React.ReactNode
  /** `sm` for a list of one-line options (no description). */
  size?: "sm" | "default"
}) {
  return (
    <Radio.Root
      data-slot="radio-card"
      className={cn(
        "group/radio-card flex w-full min-w-0 cursor-pointer gap-3 rounded-control bg-raised text-left shadow-[inset_0_0_0_1px_var(--color-line)] transition-[background-color,box-shadow] duration-150 select-none hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] data-checked:bg-signal-soft/50 data-checked:shadow-[inset_0_0_0_1.5px_var(--color-signal)] data-disabled:cursor-not-allowed data-disabled:opacity-50",
        size === "sm" ? "items-center px-3 py-2.5" : "items-start px-3.5 py-3",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border border-line-strong bg-sheet transition-colors group-data-checked/radio-card:border-signal group-data-checked/radio-card:bg-signal",
          size === "default" && "mt-0.5"
        )}
      >
        <span className="size-1.5 rounded-full bg-signal-fg opacity-0 group-data-checked/radio-card:opacity-100" />
      </span>
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-ui font-medium text-fg">{title}</span>
          {badge}
        </span>
        {description && <span className="text-xs leading-relaxed text-fg-3">{description}</span>}
      </span>
    </Radio.Root>
  )
}

export { RadioCard, RadioCards }
