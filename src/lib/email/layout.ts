// Branded email layout — 600px table layout on the dark Remnus palette.
// Everything inline-styled (email clients ignore stylesheets); tables over
// divs for Outlook. Modeled on the ScoutForge newsletter layout, restyled to
// the Remnus brand (dark three-tier background, flat borders).

import { PALETTE as P, FONT, FONT_LINK, LOGO_URL, SITE_URL } from './theme';

export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Primary CTA button (accent background, white label). */
export function button(label: string, url: string, { block = false } = {}): string {
  return `<a href="${escapeHtml(url)}" style="display:${block ? 'block' : 'inline-block'};background:${P.accent};color:#ffffff;font-family:${FONT};font-size:14px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:8px;${block ? 'text-align:center;' : ''}">${escapeHtml(label)}</a>`;
}

/** A soft "card" row used by templates for tips / example prompts. */
export function card(innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;"><tr><td style="background:${P.canvas};border:1px solid ${P.border};border-radius:10px;padding:14px 16px;">${innerHtml}</td></tr></table>`;
}

/** Numbered/bulleted step row with an accent chip. */
export function step(n: string, title: string, body: string): string {
  return card(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
      `<td width="34" valign="top"><div style="width:24px;height:24px;line-height:24px;border-radius:999px;background:${P.accentTint};color:#ffffff;font-family:${FONT};font-size:12px;font-weight:700;text-align:center;">${escapeHtml(n)}</div></td>` +
      `<td valign="top"><div style="font-family:${FONT};color:${P.soft};font-size:14px;font-weight:600;line-height:1.4;">${escapeHtml(title)}</div>` +
      `<p style="margin:4px 0 0;color:${P.body};font-size:13px;line-height:1.6;">${body}</p></td>` +
    `</tr></table>`
  );
}

export interface EmailLayoutOptions {
  /** Hidden inbox-preview line. */
  preheader?: string;
  heading: string;
  /** Pre-rendered inner HTML (paragraphs, cards, lists). */
  bodyHtml: string;
  cta?: { label: string; url: string };
  /** Footer note explaining why the recipient got this email. */
  footerNote: string;
  /** Visible unsubscribe link (omit for purely transactional sends). */
  unsubUrl?: string | null;
}

export function renderEmailLayout({ preheader, heading, bodyHtml, cta, footerNote, unsubUrl }: EmailLayoutOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(heading)}</title>
  ${FONT_LINK}
</head>
<body style="margin:0;padding:0;background:${P.bg};font-family:${FONT};color:${P.body};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${P.bg}" style="background:${P.bg};padding:28px 0;">
    <tr><td align="center" style="padding:0 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="${P.card}" style="background:${P.card};border:1px solid ${P.border};border-radius:14px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:22px 28px;border-bottom:1px solid ${P.border};">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td width="42" valign="middle"><img src="${LOGO_URL}" width="34" height="34" alt="Remnus" style="display:block;border:0;border-radius:8px;" /></td>
            <td valign="middle"><a href="${SITE_URL}" style="font-family:${FONT};color:${P.heading};font-size:19px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">Remnus</a></td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:30px 28px 8px;">
          <h1 style="font-family:${FONT};color:${P.heading};font-size:23px;font-weight:700;line-height:1.3;margin:0 0 16px;">${escapeHtml(heading)}</h1>
          ${bodyHtml}
        </td></tr>

        ${cta ? `<tr><td style="padding:10px 28px 30px;">${button(cta.label, cta.url)}</td></tr>` : '<tr><td style="padding:0 0 22px;"></td></tr>'}

        <!-- Footer -->
        <tr><td style="padding:20px 28px;border-top:1px solid ${P.border};background:${P.bg};">
          <p style="margin:0 0 6px;color:${P.muted};font-size:12px;line-height:1.6;">${escapeHtml(footerNote)}</p>
          <p style="margin:0;color:${P.muted};font-size:12px;line-height:1.6;">
            © ${new Date().getFullYear()} Remnus · <a href="${SITE_URL}" style="color:${P.muted};text-decoration:underline;">remnus.com</a>${unsubUrl ? ` · <a href="${escapeHtml(unsubUrl)}" style="color:${P.muted};text-decoration:underline;">Unsubscribe</a>` : ''}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Standard paragraph helper for template bodies. */
export function para(html: string): string {
  return `<p style="margin:0 0 14px;color:${P.body};font-size:14px;line-height:1.7;">${html}</p>`;
}
