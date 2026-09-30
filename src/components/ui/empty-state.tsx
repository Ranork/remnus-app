import * as React from "react"
import { cn } from "@/lib/cn"

// An empty screen is an invitation to act: say what will appear here and how to put the
// first thing in, then offer that one action. No mood copy, no illustration.
//
//   <EmptyState icon={<Inbox />} title="Çöp kutusu boş" description="Sildiğin sayfalar 30 gün burada kalır.">
//     <Button …>…</Button>
//   </EmptyState>

function EmptyState({
  icon,
  title,
  description,
  children,
  size = "default",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** `sm` for an empty list inside a card or panel. */
  size?: "sm" | "default"
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center text-center",
        size === "sm" ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className
      )}
      {...props}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            "flex items-center justify-center rounded-surface bg-raised text-fg-3 shadow-[inset_0_0_0_1px_var(--color-line)] [&_svg]:shrink-0",
            size === "sm" ? "size-8 [&_svg:not([class*='size-'])]:size-4" : "size-10 [&_svg:not([class*='size-'])]:size-5"
          )}
        >
          {icon}
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className={cn("font-medium text-fg", size === "sm" ? "text-ui" : "text-sm")}>{title}</p>
        {description && <p className="text-xs leading-relaxed text-fg-3">{description}</p>}
      </div>
      {children && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  )
}

export { EmptyState }
