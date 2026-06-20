import type { Viewport } from 'next';
import { Onest, JetBrains_Mono, Fraunces } from 'next/font/google';
import './globals.css';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import DebugConsole from '@/components/providers/DebugConsole';

const onest = Onest({
  subsets: ['latin'],
  variable: '--font-onest',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const VALID_THEMES = new Set(['remnus', 'dracula', 'tokyo-night', 'nord', 'catppuccin']);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  // Use the locale next-intl actually resolved for this request (cookie →
  // Accept-Language → default), not just the cookie — otherwise <html lang> stays
  // "en" on a first visit even when the content is rendered in the detected locale.
  const locale = await getLocale();
  const editorFontSize = cookieStore.get('remnus_editor_font_size')?.value ?? 'md';
  const defaultPageWidth = cookieStore.get('remnus_default_width')?.value ?? 'narrow';
  const rawTheme = cookieStore.get('remnus_theme')?.value;
  const theme = rawTheme && VALID_THEMES.has(rawTheme) ? rawTheme : undefined;

  // Inline script: runs before first paint — sets data-theme from cookie or system preference.
  // Only needed when no cookie is set yet (first visit).
  const antiFlashScript = !theme ? `(function(){var m=document.cookie.match(/remnus_theme=([^;]+)/);if(m&&m[1]){document.documentElement.dataset.theme=m[1];}else if(window.matchMedia('(prefers-color-scheme:light)').matches){document.documentElement.dataset.theme='catppuccin';}})();` : undefined;

  return (
    <html
      lang={locale}
      className={`${onest.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
      data-editor-size={editorFontSize}
      data-default-width={defaultPageWidth}
      data-theme={theme ?? 'remnus'}
      suppressHydrationWarning
    >
      <head>
        {antiFlashScript && (
          <script dangerouslySetInnerHTML={{ __html: antiFlashScript }} />
        )}
      </head>
      <body className="font-sans bg-neutral-950 text-neutral-50" suppressHydrationWarning>
        <DebugConsole />
        {children}
      </body>
    </html>
  );
}
