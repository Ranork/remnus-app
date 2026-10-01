"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { cn } from "@/lib/cn"

// Pick one of a few values (text size, a share's permission, a token's scope): a radio
// group drawn like the segmented tabs — a raised track, the chosen value lifted. It is a
// radio group, not tabs: arrow keys move the choice and nothing below it changes panel.
//
//   <SegmentedControl value={size} onValueChange={setSize} aria-label="Text size">
//     <SegmentedControlItem value="sm">Small</SegmentedControlItem>
//     <SegmentedControlItem value="md">Medium</SegmentedControlItem>
//   </SegmentedControl>

function SegmentedControl<T extends string>({
  value,
  onValueChange,
  className,
  size = "default",
  children,
  ...props
}: Omit<React.ComponentProps<typeof RadioGroup>, "value" | "onValueChange" | "defaultValue"> & {
  value: T
  onValueChange: (value: T) => void
  /** `default` 28px rows; `lg` 32px for a control that fills a form row. */
  size?: "default" | "lg"
}) {
  return (
    <RadioGroup
      data-slot="segmented-control"
      data-size={size}
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn(
        "group/segmented inline-flex w-fit max-w-full items-center gap-0.5 rounded-control bg-raised p-0.5 shadow-[inset_0_0_0_1px_var(--color-line)] data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </RadioGroup>
  )
}

function SegmentedControlItem({ className, ...props }: React.ComponentProps<typeof Radio.Root>) {
  return (
    <Radio.Root
      data-slot="segmented-control-item"
      className={cn(
        "inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-xs font-medium whitespace-nowrap text-fg-3 transition-[color,background-color,box-shadow] duration-150 select-none hover:text-fg-2 data-checked:bg-sheet data-checked:text-fg data-checked:shadow-lift data-disabled:cursor-not-allowed [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        "h-7 group-data-[size=lg]/segmented:h-8 group-data-[size=lg]/segmented:text-ui",
        className
      )}
      {...props}
    />
  )
}

export { SegmentedControl, SegmentedControlItem }
