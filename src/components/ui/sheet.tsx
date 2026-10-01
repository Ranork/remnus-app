"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/cn"

import {
  DialogBody,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  NESTED_DIM,
} from "@/components/ui/dialog"

// A side panel — the Dialog family (ui/dialog.tsx) anchored to the right edge and running
// the full height, for settings that need room next to what they change (a block editor,
// a long form). Same modal layer, focus trap, Escape, scroll lock and parts as Dialog;
// phones get the full width. It is always a panel: header and footer are fixed bars and
// only <SheetBody> scrolls.
//
//   <Sheet open onOpenChange={(o) => !o && close()}>
//     <SheetContent>
//       <SheetHeader><SheetTitle>…</SheetTitle></SheetHeader>
//       <SheetBody>…form…</SheetBody>
//       <SheetFooter>…buttons…</SheetFooter>
//     </SheetContent>
//   </Sheet>

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <DialogOverlay />
      <SheetPrimitive.Popup
        // The dialog slot, so the shared header/body/footer lay out as a panel.
        data-slot="dialog-content"
        data-side="right"
        className={cn(
          "fixed inset-y-0 right-0 z-300 flex w-full flex-col bg-float text-fg-2 shadow-modal outline-none animate-slide-in-right sm:w-100",
          NESTED_DIM,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && <DialogCloseButton />}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  )
}

const SheetHeader = DialogHeader
const SheetBody = DialogBody
const SheetFooter = DialogFooter
const SheetTitle = DialogTitle
const SheetDescription = DialogDescription

export { Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger }
