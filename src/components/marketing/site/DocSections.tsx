import type { LucideIcon } from 'lucide-react';

export type DocSection = { icon?: LucideIcon; title: string; body: React.ReactNode };

/** A policy-style page body (privacy, security): each section a heading on the left and its text on the right, ruled. */
export default function DocSections({ sections }: { sections: DocSection[] }) {
  return (
    <div className="mt-12 lg:mt-16">
      {sections.map(({ icon: Icon, title, body }) => (
        <section key={title} className="grid gap-3 border-t border-line-strong py-8 lg:grid-cols-12 lg:gap-10">
          <h2 className="m-0 flex items-center gap-3 self-start text-lg font-semibold tracking-[-0.015em] text-fg lg:col-span-4">
            {Icon && <Icon className="size-[18px] shrink-0 text-fg-3" aria-hidden />}
            {title}
          </h2>
          <div className="max-w-[44rem] text-[15px] leading-[1.7] text-fg-2 lg:col-span-8 [&_p]:m-0 [&_p+p]:mt-3">{body}</div>
        </section>
      ))}
    </div>
  );
}
