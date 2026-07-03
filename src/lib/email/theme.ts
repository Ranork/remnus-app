// Shared email theme — Remnus brand palette (dark), mirrored from the @theme
// tokens in src/app/globals.css. Email clients require inline hex values (no
// CSS variables), so the palette is duplicated here as literals — keep in sync
// with globals.css if the brand colors ever change.

export const PALETTE = {
  bg: '#1d1f23',        // outer canvas (neutral-950)
  card: '#21252b',      // card / sidebar bg (neutral-900)
  canvas: '#282c34',    // inner panel bg (neutral-850)
  border: '#383b41',    // borders / dividers (neutral-800)
  heading: '#f2f3f5',   // headings (near-white on dark)
  soft: '#d7dae0',      // emphasized text (neutral-50)
  body: '#cccccc',      // body text (neutral-100)
  muted: '#8f959e',     // secondary / footer text
  accent: '#445c95',    // primary / accent (blue-500)
  accentTint: '#2b3a5c',// dimmed accent (chips / list bullets on dark)
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
