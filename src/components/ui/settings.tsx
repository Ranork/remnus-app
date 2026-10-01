import * as React from "react"
import { cn } from "@/lib/cn"

// The building blocks of a settings page (user + workspace settings, V2 R8.5). A page is a
// stack of sections; a section is a sentence-case heading, an optional line under it and
// its rows or fields. Sections are divided by a hairline, never boxed — except the one
// danger zone, which is the single red-edged block a page may have.
//
//   <SettingsPage>
//     <SettingsSection title="Appearance" description="…">
//       <SettingsRow label="Theme" hint="…"><SegmentedControl …/></SettingsRow>
//     </SettingsSection>
//     <SettingsSection title="Name">
//       <Field label="Workspace name" hint="…"><Input …/></Field>
//     </SettingsSection>
//     <DangerZone title="…" description="…" action={<Button variant="danger" …/>} />
//   </SettingsPage>

function SettingsPage({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="settings-page" className={cn("flex flex-col gap-6", className)} {...props} />
}

function SettingsSection({
  title,
  description,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode
  description?: React.ReactNode
  /** A small control on the heading's line (a refresh button, a count). */
  action?: React.ReactNode
}) {
  return (
    <section
      data-slot="settings-section"
      className={cn(
        "flex flex-col gap-3 [&+&]:border-t [&+&]:border-line [&+&]:pt-6",
        className
      )}
      {...props}
    >
      {(title || description || action) && (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-sm font-semibold text-fg">{title}</h3>}
            {description && <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Rows of one section, a hairline between each. */
function SettingsList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-list"
      className={cn("flex flex-col divide-y divide-line *:py-3.5 *:first:pt-0 *:last:pb-0", className)}
      {...props}
    />
  )
}

/** A label (and hint) on the left, its control on the right; stacked on a phone. */
function SettingsRow({
  label,
  hint,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  label: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div
      data-slot="settings-row"
      className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}
      {...props}
    >
      <div className="min-w-0">
        <p className="text-ui font-medium text-fg">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/** A stacked form field: label, control, then a hint or the error that replaces it. */
function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  label?: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: React.ReactNode
}) {
  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)} {...props}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-fg-2">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs leading-relaxed text-red-400">{error}</p>
      ) : (
        hint && <p className="text-xs leading-relaxed text-fg-3">{hint}</p>
      )}
    </div>
  )
}

/** The one place a settings page turns red: what can't be undone, and the button that does it. */
function DangerZone({
  title,
  description,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  action: React.ReactNode
}) {
  return (
    <section
      data-slot="danger-zone"
      className={cn(
        "flex flex-col gap-3 rounded-surface p-4 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-red-400)_35%,transparent)]",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-red-400">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      </div>
      {children}
    </section>
  )
}

export { DangerZone, Field, SettingsList, SettingsPage, SettingsRow, SettingsSection }
