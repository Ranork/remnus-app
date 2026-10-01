"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { useTranslations } from "next-intl"
import { AlertTriangleIcon, CheckCircle2Icon, XIcon } from "lucide-react"
import { cn } from "@/lib/cn"

import { buttonVariants } from "@/components/ui/button"

// The app's one notification (V2 R8.5), on Base UI's Toast: a small float card in the
// bottom-right corner (above the mobile nav and the cookie bar on smaller screens),
// newest nearest the corner, announced to screen readers, F6 jumps into the stack, and a
// swipe right or down dismisses it. One look for every kind — a finished download, a
// failed delete, an update that is downloading — told apart by a semantic icon, never by
// a coloured card.
//
//   toast({ title: t('downloadComplete'), description: name, tone: 'success',
//           action: { label: t('showInFolder'), onClick: reveal } })
//   const id = toast({ title, timeout: 0 })      // stays until closed or updated
//   toast.update(id, { progress: 40 })            // a live bar (signal = live)
//   toast.close(id)
//
// <Toaster /> is mounted once, in the (app) layout. `toast()` works from anywhere —
// event listeners, actions, plain functions — through the module-level manager.

type ToastTone = "neutral" | "success" | "error"

interface ToastData {
  tone: ToastTone
  icon?: React.ReactNode
  progress?: number
  dismissible: boolean
}

interface ToastOptions {
  /** Reuse an id to replace a toast in place (and restart its timer). */
  id?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** `error` is announced at once and gets the warning icon; `success` a check. */
  tone?: ToastTone
  /** Replaces the tone's icon (an app icon, a download glyph…). */
  icon?: React.ReactNode
  /** One action button under the text. It does not close the toast by itself. */
  action?: { label: React.ReactNode; onClick: () => void }
  /** 0–100: shows a progress bar. */
  progress?: number
  /** ms before it goes away; 0 keeps it until closed. Default 6000. */
  timeout?: number
  /** Show the × (default true). */
  dismissible?: boolean
  onClose?: () => void
}

const manager = ToastPrimitive.createToastManager()

function toAddOptions(options: Partial<ToastOptions>) {
  const tone = options.tone ?? "neutral"
  return {
    title: options.title,
    description: options.description,
    type: tone,
    timeout: options.timeout,
    priority: tone === "error" ? ("high" as const) : ("low" as const),
    actionProps: options.action
      ? { children: options.action.label, onClick: options.action.onClick }
      : undefined,
    onClose: options.onClose,
    data: {
      tone,
      icon: options.icon,
      progress: options.progress,
      dismissible: options.dismissible ?? true,
    } satisfies ToastData,
  }
}

function toast(options: ToastOptions): string {
  return manager.add({ ...toAddOptions(options), id: options.id, timeout: options.timeout ?? 6000 })
}

/** Change a toast in place. Fields left out keep their value. */
toast.update = (id: string, options: Partial<ToastOptions>) => {
  manager.update(id, (prev) => {
    const prevData = (prev.data ?? {}) as Partial<ToastData>
    const next = toAddOptions({
      title: prev.title,
      description: prev.description,
      tone: prevData.tone,
      icon: prevData.icon,
      progress: prevData.progress,
      dismissible: prevData.dismissible,
      ...options,
    })
    return {
      ...next,
      timeout: options.timeout ?? prev.timeout,
      actionProps: "action" in options ? next.actionProps : prev.actionProps,
    }
  })
}

toast.close = (id?: string) => manager.close(id)

const TONE_ICON: Record<ToastTone, React.ReactNode> = {
  neutral: null,
  success: <CheckCircle2Icon className="text-green-400" />,
  error: <AlertTriangleIcon className="text-red-400" />,
}

function ToastList() {
  const t = useTranslations("UI")
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map((item) => {
    const data = (item.data ?? {}) as Partial<ToastData>
    const icon = data.icon ?? TONE_ICON[data.tone ?? "neutral"]
    const dismissible = data.dismissible ?? true
    return (
      <ToastPrimitive.Root
        key={item.id}
        toast={item}
        data-slot="toast"
        className={cn(
          "relative flex w-full items-start gap-3 rounded-surface bg-float p-3 text-fg-2 shadow-float outline-none select-none",
          "[transform:translate(var(--toast-swipe-movement-x),var(--toast-swipe-movement-y))] transition-[opacity,translate] duration-200 ease-snappy data-swiping:transition-none motion-reduce:transition-none",
          "data-starting-style:translate-y-2 data-starting-style:opacity-0 data-ending-style:opacity-0 data-limited:hidden",
          dismissible && "pr-10"
        )}
      >
        {icon && (
          <span className="mt-0.5 flex min-h-4 min-w-4 shrink-0 items-center justify-center text-fg-3 [&_svg]:size-4">
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <ToastPrimitive.Title className="text-ui leading-snug font-medium text-fg" />
          <ToastPrimitive.Description className="mt-0.5 text-xs leading-relaxed break-words text-fg-3 empty:hidden" />
          {typeof data.progress === "number" && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(data.progress)}
              className="mt-2.5 h-1 overflow-hidden rounded-full bg-hover"
            >
              <div
                className="h-full rounded-full bg-signal transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${Math.max(0, Math.min(100, data.progress))}%` }}
              />
            </div>
          )}
          {item.actionProps && (
            <ToastPrimitive.Action className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-2.5 self-start")} />
          )}
        </div>
        {dismissible && (
          <ToastPrimitive.Close
            aria-label={t("close")}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "absolute top-2 right-2")}
          >
            <XIcon />
          </ToastPrimitive.Close>
        )}
      </ToastPrimitive.Root>
    )
  })
}

/** Mount once. The stack sits above the mobile nav (below `lg`) and the cookie bar. */
function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={manager} limit={3}>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport
          data-slot="toaster"
          className="fixed inset-x-4 bottom-[calc(var(--consent-banner-height,0px)+4.5rem)] z-400 mx-auto flex max-w-90 flex-col-reverse gap-2 outline-none lg:right-4 lg:bottom-[calc(var(--consent-banner-height,0px)+1rem)] lg:left-auto lg:mx-0 lg:w-90"
        >
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

/** The toast's look, for a prompt that has to stay a small form of its own (demo feedback). */
const toastSurfaceClass = "rounded-surface bg-float text-fg-2 shadow-float"

export { Toaster, toast, toastSurfaceClass, type ToastOptions }
