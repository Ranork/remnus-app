"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useTranslations } from "next-intl"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/cn"

import { Button } from "@/components/ui/button"

// The app's one modal family (V2 R8.5), on Base UI's Dialog: focus trap, Escape, scroll
// lock, aria-labelledby/-describedby and nested-dialog stacking come from Base UI. The
// surface is the float layer (bg-float, rounded-surface, shadow-modal — no border, the
// shadow carries the edge) on z-300. From `sm` up it is centred; on a phone it rises from
// the bottom edge as a sheet. A dialog opened from another dims its parent.
//
// Two shapes, picked by the content (see the custom variants at the top of globals.css):
//  - compact: header, a line or a field, footer — padded as one block (confirmations,
//    naming something).
//  - panel: put the content in <DialogBody>. Header and footer turn into fixed bars with a
//    hairline and only the body scrolls. Anything that can outgrow the screen is a panel.
//
//   <Dialog open onOpenChange={(open) => !open && onClose()}>
//     <DialogContent size="lg">
//       <DialogHeader>
//         <DialogTitle>…</DialogTitle>
//         <DialogDescription>…</DialogDescription>
//       </DialogHeader>
//       <DialogBody>…</DialogBody>
//       <DialogFooter>…</DialogFooter>
//     </DialogContent>
//   </Dialog>
//
// Sizes set the width from `sm` up (a phone always gets the full width):
//   sm 24rem — a confirmation, one field          md 32rem — a short task (share, crop)
//   lg 44rem — a list or a picker                 full 60rem × a fixed height — settings
//                                                 with a nav, a long timeline (tabs never
//                                                 make it jump)
// A side panel is the same family: `ui/sheet.tsx`.

type DialogSize = "sm" | "md" | "lg" | "full"

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-176",
  full: "h-[calc(100dvh-2rem)] sm:h-[min(46rem,calc(100dvh-4rem))] sm:max-w-240",
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 isolate z-300 bg-overlay animate-fade-in", className)}
      {...props}
    />
  )
}

/** The × in the corner. Shared with the side panel (ui/sheet.tsx). */
function DialogCloseButton() {
  const t = useTranslations("UI")
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3 z-1" />}
    >
      <XIcon />
      <span className="sr-only">{t("close")}</span>
    </DialogPrimitive.Close>
  )
}

/** Dims a dialog while a dialog it opened sits on top (Base UI sets the attribute). */
const NESTED_DIM =
  "after:pointer-events-none after:absolute after:inset-0 after:z-2 after:rounded-[inherit] after:bg-overlay after:opacity-0 after:transition-opacity after:duration-150 data-nested-dialog-open:after:opacity-100"

function DialogContent({
  className,
  children,
  size = "sm",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  size?: DialogSize
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          // Phone: a sheet from the bottom edge.
          "fixed inset-x-0 bottom-0 z-300 flex max-h-[calc(100dvh-2rem)] flex-col rounded-t-surface bg-float text-fg-2 shadow-modal outline-none animate-sheet-up",
          // From `sm`: centred.
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100vw-4rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-surface sm:animate-scale-in",
          "dialog-compact:gap-4 dialog-compact:overflow-y-auto dialog-compact:overscroll-contain dialog-compact:p-5 max-sm:dialog-compact:pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
          NESTED_DIM,
          SIZE_CLASS[size],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && <DialogCloseButton />}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-1",
        "in-dialog-compact:pr-8",
        "in-dialog-panel:shrink-0 in-dialog-panel:border-b in-dialog-panel:border-line in-dialog-panel:py-4 in-dialog-panel:pr-12 in-dialog-panel:pl-5",
        className
      )}
      {...props}
    />
  )
}

/** The scrolling middle. Its presence makes the dialog a panel (fixed header/footer). */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 max-sm:last:pb-[calc(1rem+env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-wrap items-center justify-end gap-2",
        "in-dialog-compact:pt-1",
        "in-dialog-panel:shrink-0 in-dialog-panel:border-t in-dialog-panel:border-line in-dialog-panel:px-5 in-dialog-panel:py-3 max-sm:in-dialog-panel:pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-[15px] leading-snug font-semibold text-fg", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-ui leading-relaxed text-fg-3", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  NESTED_DIM,
  type DialogSize,
}
