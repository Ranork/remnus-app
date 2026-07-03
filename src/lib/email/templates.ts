// Lifecycle email templates + newsletter renderer. Emails are English-only by
// design (recipient locale isn't stored server-side); copy lives here, NOT in
// the i18n message files.

import { marked } from 'marked';
import { PALETTE as P, FONT, SITE_URL } from './theme';
import { renderEmailLayout, para, card, step, escapeHtml } from './layout';

export interface EmailContent {
  subject: string;
  html: string;
}

const APP_URL = `${SITE_URL}/app`;

function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim().split(/\s+/)[0];
  return n || 'there';
}

// ── 1. Welcome (on signup — transactional) ────────────────────────────────────

export function welcomeEmail(name: string | null | undefined, unsubUrl: string): EmailContent {
  const bodyHtml =
    para(`Hi ${escapeHtml(firstName(name))} 👋`) +
    para(`Welcome to <strong style="color:${P.soft};">Remnus</strong> — a workspace where your pages and databases live side by side with your AI agents. Everything you write is instantly reachable by the tools you already use, over MCP.`) +
    para(`Three quick ways to get going:`) +
    step('1', 'Create your first page', `Hit <strong style="color:${P.soft};">+</strong> in the sidebar — pages, databases with table/kanban/calendar views, all in one tree.`) +
    step('2', 'Connect an AI agent', `Open <strong style="color:${P.soft};">AI Agents</strong> in the sidebar and link Claude, Cursor, VS Code or any MCP client in about two minutes.`) +
    step('3', 'Take Remnus everywhere', `Install the <a href="${SITE_URL}/download" style="color:#7a94c9;text-decoration:underline;">desktop &amp; mobile apps</a> so your workspace is one click away.`);

  return {
    subject: 'Welcome to Remnus — your workspace is ready',
    html: renderEmailLayout({
      preheader: 'Your pages, databases and AI agents — all in one workspace.',
      heading: 'Welcome to Remnus',
      bodyHtml,
      cta: { label: 'Open Remnus', url: APP_URL },
      footerNote: 'You received this email because you created a Remnus account.',
      unsubUrl,
    }),
  };
}

// ── 2. Inactivity check-in (cron, 4+ days away) ───────────────────────────────

export function inactivityEmail(name: string | null | undefined, unsubUrl: string): EmailContent {
  const bodyHtml =
    para(`Hi ${escapeHtml(firstName(name))},`) +
    para(`It's been a few days since you last opened your Remnus workspace — everything is right where you left it.`) +
    para(`If something got in the way — a missing feature, a confusing step, anything at all — <strong style="color:${P.soft};">just hit reply</strong>. A human reads every answer, and it directly shapes what we build next.`);

  return {
    subject: 'Your Remnus workspace is waiting — anything we can help with?',
    html: renderEmailLayout({
      preheader: 'Everything is where you left it. If something got in the way, just reply.',
      heading: 'Still there? 👀',
      bodyHtml,
      cta: { label: 'Jump back in', url: APP_URL },
      footerNote: 'You received this email because you have a Remnus account and have been away for a few days.',
      unsubUrl,
    }),
  };
}

// ── 3. Agent nudge (cron, 24h after signup with no agent) ─────────────────────

export function agentNudgeEmail(name: string | null | undefined, unsubUrl: string): EmailContent {
  const bodyHtml =
    para(`Hi ${escapeHtml(firstName(name))},`) +
    para(`Your workspace is set up — but the best part of Remnus is still switched off: <strong style="color:${P.soft};">connecting your AI agent</strong>. Once linked over MCP, Claude, Cursor or VS Code can read and update your pages and databases for you.`) +
    para(`It takes about two minutes:`) +
    step('1', 'Open the AI Agents panel', `In your workspace sidebar, click <strong style="color:${P.soft};">AI Agents → Connect editor</strong>.`) +
    step('2', 'Pick your tool', `Claude Code, Claude Desktop, Cursor, VS Code, Codex, Windsurf — or any other MCP client.`) +
    step('3', 'Approve access', `Sign in once via OAuth, choose the workspace, done. Every agent action is logged and revocable.`);

  return {
    subject: 'Your workspace is ready for AI — 2 minutes to connect',
    html: renderEmailLayout({
      preheader: 'Connect Claude, Cursor or VS Code to your workspace in about two minutes.',
      heading: 'Plug your AI into Remnus',
      bodyHtml,
      cta: { label: 'Connect an agent', url: APP_URL },
      footerNote: "You received this email because you recently created a Remnus account and haven't connected an AI agent yet.",
      unsubUrl,
    }),
  };
}

// ── 4. Agent connected (instant, first token) ─────────────────────────────────

export function agentConnectedEmail(name: string | null | undefined, unsubUrl: string): EmailContent {
  const prompt = (text: string) =>
    card(`<span style="font-family:'JetBrains Mono',Consolas,monospace;color:${P.soft};font-size:13px;line-height:1.6;">&ldquo;${escapeHtml(text)}&rdquo;</span>`);

  const bodyHtml =
    para(`Hi ${escapeHtml(firstName(name))},`) +
    para(`🎉 Your AI agent is connected to Remnus. From now on it can search, read and update your workspace over MCP. Here are a few things people ask their agents to do:`) +
    prompt('Summarize my meeting-notes page and list the open questions.') +
    prompt('Create a weekly status report from my Tasks database.') +
    prompt("Triage my kanban board — what's stuck or overdue?") +
    prompt('Extract every action item from this page into my Tasks database.') +
    prompt('Search my workspace for everything about the launch and build a summary page.') +
    para(`Every change an agent makes is stamped and logged — check the activity log in <strong style="color:${P.soft};">AI Agents</strong> anytime.`);

  return {
    subject: "Your agent is connected — here's what to try first",
    html: renderEmailLayout({
      preheader: 'Five prompts to put your newly connected agent to work.',
      heading: 'Agent connected ✓',
      bodyHtml,
      cta: { label: 'Open your workspace', url: APP_URL },
      footerNote: 'You received this email because you connected an AI agent to your Remnus workspace.',
      unsubUrl,
    }),
  };
}

// ── 5. Newsletter (admin-composed markdown) ───────────────────────────────────

// Email clients ignore stylesheets, so the markdown-rendered HTML gets its
// styles injected inline per tag. Coarse but reliable across clients.
const MD_TAG_STYLES: Record<string, string> = {
  h1: `font-family:${FONT};color:${P.heading};font-size:22px;font-weight:700;line-height:1.35;margin:22px 0 10px;`,
  h2: `font-family:${FONT};color:${P.heading};font-size:18px;font-weight:700;line-height:1.35;margin:20px 0 8px;`,
  h3: `font-family:${FONT};color:${P.soft};font-size:15px;font-weight:600;line-height:1.4;margin:16px 0 6px;`,
  p: `margin:0 0 13px;color:${P.body};font-size:14px;line-height:1.7;`,
  ul: `margin:0 0 13px;padding-left:22px;color:${P.body};font-size:14px;line-height:1.7;`,
  ol: `margin:0 0 13px;padding-left:22px;color:${P.body};font-size:14px;line-height:1.7;`,
  li: `margin:0 0 4px;`,
  a: `color:#7a94c9;text-decoration:underline;`,
  blockquote: `margin:0 0 13px;padding:10px 16px;border-left:3px solid ${P.accent};background:${P.canvas};color:${P.soft};font-size:14px;line-height:1.7;`,
  hr: `border:none;border-top:1px solid ${P.border};margin:20px 0;`,
  img: `max-width:100%;height:auto;border-radius:8px;border:1px solid ${P.border};display:block;margin:0 0 13px;`,
  code: `font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;background:${P.canvas};color:${P.soft};padding:1px 5px;border-radius:4px;`,
  pre: `font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;background:${P.canvas};border:1px solid ${P.border};color:${P.soft};padding:12px 14px;border-radius:8px;overflow-x:auto;margin:0 0 13px;line-height:1.6;`,
  strong: `color:${P.soft};`,
  table: `border-collapse:collapse;margin:0 0 13px;width:100%;`,
  th: `border:1px solid ${P.border};padding:6px 10px;color:${P.soft};font-size:13px;text-align:left;background:${P.canvas};`,
  td: `border:1px solid ${P.border};padding:6px 10px;color:${P.body};font-size:13px;`,
};

function inlineMdStyles(html: string): string {
  return html.replace(/<(h1|h2|h3|p|ul|ol|li|a|blockquote|hr|img|code|pre|strong|table|th|td)(\s|>|\/)/g, (m, tag, after) => {
    const style = MD_TAG_STYLES[tag];
    if (!style) return m;
    return `<${tag} style="${style}"${after === '>' || after === '/' ? after : ' '}`;
  });
}

export function renderNewsletterHtml(
  campaign: { subject: string; preheader: string | null; bodyMd: string },
  unsubUrl: string,
): string {
  const rendered = marked.parse(campaign.bodyMd, { async: false, gfm: true, breaks: true }) as string;
  return renderEmailLayout({
    preheader: campaign.preheader ?? undefined,
    heading: campaign.subject,
    bodyHtml: inlineMdStyles(rendered),
    footerNote: 'You received this update because you have a Remnus account.',
    unsubUrl,
  });
}
