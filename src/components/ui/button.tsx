import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/cn"

// Variants are the ones the app already drew by hand (primary = the blue call to
// action, secondary = neutral chip, ghost = text button, danger = destructive
// confirm), so moving a button onto this component changes nothing visually.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:pointer-events-none disabled:opacity-50 aria-busy:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-blue-500 text-white font-semibold hover:bg-blue-400",
        secondary: "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100",
        ghost: "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
        danger: "bg-red-500/80 text-white font-semibold hover:bg-red-500",
      },
      size: {
        xs: "h-6 gap-1 rounded px-2 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-md px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-8 gap-1.5 px-4 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
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
