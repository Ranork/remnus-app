'use client';
import { useActionState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { loginAsDemo } from '@/lib/actions/demo';

interface HeroDemoOverlayProps {
  buttonLabel: string;
  loadingLabel: string;
}

export function HeroDemoButton({ buttonLabel, loadingLabel }: HeroDemoOverlayProps) {
  const [, formAction, isPending] = useActionState(loginAsDemo, null);

  return (
    <form action={formAction} className="w-full">
      <button
        type="submit"
        disabled={isPending}
        className="group/demo flex min-h-16 w-full items-center justify-between gap-4 rounded-md border border-blue-400/30 bg-blue-500 px-5 py-3.5 text-left text-white ring-1 ring-inset ring-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-strong disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        <span className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-inset ring-white/15 transition-colors group-hover/demo:bg-white/15">
            {isPending ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Play size={16} fill="currentColor" aria-hidden="true" />
            )}
          </span>
          <span className="truncate text-base font-semibold tracking-[-0.01em]">
            {isPending ? loadingLabel : buttonLabel}
          </span>
        </span>
        <ArrowRight
          size={18}
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200 group-hover/demo:translate-x-1"
        />
      </button>
    </form>
  );
}

export function HeroDemoOverlay({ buttonLabel, loadingLabel }: HeroDemoOverlayProps) {
  const [, formAction, isPending] = useActionState(loginAsDemo, null);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      <div className={`transition-all duration-200 ease-out pointer-events-auto ${isPending ? 'opacity-100 translate-y-0' : 'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0'}`}>
        <form action={formAction}>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2.5 bg-blue-500/90 hover:bg-blue-500 text-white text-[15px] font-semibold px-6 py-3.5 rounded-md backdrop-blur-md transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 0 60px rgba(68,92,149,0.7), 0 0 120px rgba(68,92,149,0.3), 0 8px 32px rgba(0,0,0,0.5)' }}
          >
            {isPending ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                {loadingLabel}
              </>
            ) : (
              <>
                <span className="text-[13px]">▶</span>
                {buttonLabel}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
