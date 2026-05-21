import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import AIMark from './AIMark';

type AIId = 'claude' | 'cursor' | 'windsurf' | 'chatgpt' | 'continue' | 'zed';

const AI_CLIENTS: { id: AIId; name: string }[] = [
  { id: 'claude',   name: 'Claude'   },
  { id: 'cursor',   name: 'Cursor'   },
  { id: 'windsurf', name: 'Windsurf' },
  { id: 'chatgpt',  name: 'ChatGPT'  },
  { id: 'continue', name: 'Continue' },
  { id: 'zed',      name: 'Zed'      },
];

export default async function LandingClosing() {
  const t = await getTranslations('Landing');

  return (
    <section className="px-4 sm:px-8 lg:px-14 py-20 lg:py-[120px] text-center">
      <div className="font-mono text-[11px] text-dim uppercase tracking-[0.18em] mb-7">
        {t('bridgeClosingKicker')}
      </div>

      <h2
        className="font-sans font-semibold text-neutral-100 leading-[0.98] m-0 text-[44px] sm:text-[62px] lg:text-[84px]"
        style={{ letterSpacing: '-0.035em' }}
      >
        {t('bridgeClosingH2Part1')}
        <br />
        <span className="font-serif italic text-accent-strong text-[48px] sm:text-[68px] lg:text-[90px]">
          {t('bridgeClosingH2Accent')}
        </span>
      </h2>

      <p className="mt-7 mx-auto text-base lg:text-[17px] text-dim max-w-[520px] leading-[1.55]">
        {t('bridgeClosingSub')}
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 justify-center">
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-blue-500 hover:bg-accent-strong text-white px-[22px] py-[15px] rounded-md text-[15px] font-medium transition-colors duration-150 w-full sm:w-auto justify-center"
        >
          {t('bridgeClosingCtaPrimary')}
          <span aria-hidden>→</span>
        </Link>
        <Link
          href="/login?demo=1"
          className="inline-flex items-center justify-center px-[22px] py-[15px] rounded-md border border-neutral-800 text-[15px] text-neutral-50 hover:border-neutral-100 transition-colors duration-150 w-full sm:w-auto"
        >
          {t('bridgeClosingCtaOutline')}
        </Link>
      </div>

      {/* AI clients — grid on mobile, pill on sm+ */}
      <div className="mt-10 lg:mt-14">
        <div className="grid grid-cols-3 gap-2.5 sm:hidden mx-auto max-w-70">
          {AI_CLIENTS.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg">
              <AIMark name={c.id} size={15} />
              <span className="text-[12px] text-neutral-50 font-medium truncate">{c.name}</span>
            </div>
          ))}
        </div>
        <div className="hidden sm:inline-flex items-center gap-7 px-7 py-3.5 bg-neutral-900 border border-neutral-800 rounded-full">
          {AI_CLIENTS.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-2">
              <AIMark name={c.id} size={18} />
              <span className="text-[13.5px] text-neutral-50 font-medium">{c.name}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
