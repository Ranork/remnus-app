// Shared email theme — Remnus brand palette (dark), mirrored from the @theme
// role tokens in src/app/globals.css (V2 R8: desk/sheet/raised, ink primary, one
// yellow signal). Email clients require inline hex values (no
// CSS variables), so the palette is duplicated here as literals — keep in sync
// with globals.css if the brand colors ever change.

export const PALETTE = {
  bg: '#111316',        // outer canvas (desk)
  card: '#191b1f',      // the email body (sheet)
  canvas: '#1f2226',    // inner panel bg (raised)
  border: '#2a2d33',    // borders / dividers (line)
  heading: '#eceef1',   // headings (fg)
  soft: '#dcdfe4',      // emphasized text (neutral-100)
  body: '#b0b4bc',      // body text (fg-2)
  muted: '#979ca5',     // secondary / footer text (fg-3)
  ink: '#eceef1',       // primary button fill (ink)
  inkFg: '#111316',     // primary button label (ink-fg)
  signal: '#f0b43c',    // the one accent: step chips, quote rule
  signalFg: '#1c1504',  // text on a signal fill
  link: '#f3c566',      // inline links (link)
  success: '#7fc36d',   // green-400
  warning: '#cc7d45',   // amber-500
  destructive: '#cd4d55', // red-400
};

// Brand font: Onest (same as the app UI). Loaded via Google Fonts <link> in
// clients that support it (Apple Mail etc.); Gmail/Outlook fall back.
export const FONT = "'Onest','Segoe UI',Tahoma,Arial,Helvetica,sans-serif";
export const FONT_LINK =
  '<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;600;700&display=swap" rel="stylesheet" type="text/css" /><!--<![endif]-->';

// Always link to the www host directly — the apex 307-redirects to www, and an
// extra redirect hop in email links is both slower and worse for spam scoring.
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.remnus.com';

// Email-safe PNG logo (square dark variant served from public/).
export const LOGO_URL = `${SITE_URL}/logo-square-dark.png`;
