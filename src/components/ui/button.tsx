import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/cn"

// The R8 language: one primary (ink — white on dark themes, near-black on light), quiet
// neutrals around it, red only for destructive confirms, and `signal` (the yellow accent)
// for the rare call to action that should out-shout everything else on the screen.
// Focus uses the app-wide :focus-visible ring (globals.css), so no ring classes here.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap transition-[color,background-color,box-shadow,opacity] duration-150 select-none disabled:pointer-events-none disabled:opacity-45 aria-busy:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-ink-fg font-semibold hover:bg-ink/88 active:bg-ink/80",
        secondary:
          "bg-raised text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-hover hover:text-fg",
        outline:
          "text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-hover hover:text-fg",
        ghost: "text-fg-3 hover:bg-hover hover:text-fg",
        danger: "bg-red-500 text-white font-semibold hover:bg-red-500/88 active:bg-red-500/80",
        signal: "bg-signal text-signal-fg font-semibold hover:bg-signal/88 active:bg-signal/80",
      },
      size: {
        xs: "h-6 gap-1 rounded-sm px-2 text-2xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-8 gap-1.5 px-3.5 text-ui [&_svg:not([class*='size-'])]:size-4",
        lg: "h-10 gap-2 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Work is running: shows a spinner in place of the label (the button keeps its
     *  width), disables it so a second click can't fire the action again, and sets
     *  `aria-busy` for screen readers. */
    loading?: boolean
  }

function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-[inherit]">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2Icon className="animate-spin" aria-hidden />
          </span>
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants, type ButtonProps }
