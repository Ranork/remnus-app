"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "@/lib/cn"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

// shadcn/ui Select on Base UI, restyled to the app's flat neutral look. Most call
// sites want <SimpleSelect> at the bottom; the parts are exported for the rare one
// that needs groups or custom item rendering.
//
// Layering: the popup is portalled to <body> and sits on z-9999 — the layer the
// app's context menus use — so a select inside a z-300 modal opens in front of it.

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 py-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex min-w-0 flex-1 truncate text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "xs" | "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit shrink-0 cursor-pointer items-center justify-between gap-1.5 rounded border border-neutral-700 bg-neutral-800 text-neutral-200 whitespace-nowrap transition-colors outline-none select-none hover:border-neutral-600 focus-visible:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500 data-placeholder:text-neutral-500 data-[size=default]:h-8 data-[size=default]:px-2.5 data-[size=default]:text-xs data-[size=sm]:h-7 data-[size=sm]:px-2 data-[size=sm]:text-xs data-[size=xs]:h-5 data-[size=xs]:px-1.5 data-[size=xs]:text-[10px] data-[size=xs]:font-semibold *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-3.5 text-neutral-500" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-9999"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative isolate max-h-(--available-height) w-(--anchor-width) min-w-40 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded border border-neutral-700 bg-neutral-900 py-1 text-neutral-100 shadow-xl outline-none",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2.5 py-1 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 py-1.5 pr-8 pl-2.5 text-xs text-neutral-300 outline-hidden select-none data-highlighted:bg-neutral-800 data-highlighted:text-neutral-50 data-selected:text-neutral-100 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex min-w-0 flex-1 items-center gap-2 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center text-blue-400" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none my-1 h-px bg-neutral-800", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-neutral-900 py-1 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-neutral-900 py-1 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  )
}

// ── SimpleSelect ───────────────────────────────────────────────────────────────
// The drop-in for a native <select>: a flat option list, string values.

interface SelectOption {
  value: string
  label: React.ReactNode
  /** Shown before the label, in the list and in the trigger. */
  icon?: React.ReactNode
  /** A colour dot before the label (any CSS colour), e.g. a status or tag colour. */
  color?: string
  disabled?: boolean
}

interface SimpleSelectProps {
  value: string | null
  onValueChange: (value: string) => void
  options: ReadonlyArray<SelectOption>
  placeholder?: React.ReactNode
  disabled?: boolean
  size?: "xs" | "sm" | "default"
  /** Classes for the trigger (width, alignment…). */
  className?: string
  contentClassName?: string
  /** Required when there is no visible <label> for the control. */
  "aria-label"?: string
  id?: string
  name?: string
  title?: string
  style?: React.CSSProperties
  /** Stop clicks reaching a clickable parent (e.g. a chip that is itself a button). */
  stopPropagation?: boolean
}

function OptionLabel({ option }: { option: SelectOption }) {
  return (
    <>
      {option.color && (
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} aria-hidden />
      )}
      {option.icon}
      <span className="truncate">{option.label}</span>
    </>
  )
}

function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  size,
  className,
  contentClassName,
  id,
  name,
  title,
  style,
  stopPropagation,
  ...rest
}: SimpleSelectProps) {
  const items = React.useMemo(
    () => options.map((o) => ({ value: o.value, label: <OptionLabel option={o} /> })),
    [options]
  )
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as string)
      }}
      disabled={disabled}
      name={name}
      modal={false}
    >
      <SelectTrigger
        size={size}
        className={className}
        id={id}
        aria-label={rest["aria-label"]}
        title={title}
        style={style}
        onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            <OptionLabel option={o} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SimpleSelect,
  type SelectOption,
  type SimpleSelectProps,
}
