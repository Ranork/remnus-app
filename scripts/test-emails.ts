/**
 * Sends every email template to MAIL_TEST_EMAIL for visual inbox review.
 * When mail env (MAIL_FROM_EMAIL/SES_REGION) is missing, falls back to writing
 * the rendered HTML into ./email-previews/ (git-ignored) so the templates can
 * be checked in a browser without AWS.
 *
 *   npx tsx scripts/test-emails.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'fs';
import path from 'path';
import {
  welcomeEmail,
  inactivityEmail,
  agentNudgeEmail,
  agentConnectedEmail,
  renderNewsletterHtml,
} from '../src/lib/email/templates';
import { isMailConfigured, sendEmail, sleep, throttleDelayMs } from '../src/lib/email/send';

const SAMPLE_NEWSLETTER = {
  subject: 'What’s new in Remnus — sample newsletter',
  preheader: 'Tables got cell colors, the editor got a block toolbar, and more.',
  bodyMd: [
    '## Editor upgrades',
    'Tables now support **cell background colors** and drag-resizable columns. Select a few blocks and the new floating toolbar lets you format all of them at once.',
    '',
    '- Multi-block selection with a marquee drag',
    '- `/table` slash command with a full control strip',
    '- Copy any block as clean markdown',
    '',
    '## MCP news',
    'The health endpoint now reports transport readiness — see [the docs](https://www.remnus.com/security) for details.',
    '',
    '> Tip: connect Claude Desktop with the one-click `.mcpb` bundle from the download page.',
  ].join('\n'),
};

async function main() {
  const unsubSample = '#';
  const templates = [
    { name: 'welcome', ...welcomeEmail('Hakan Temur', unsubSample) },
    { name: 'inactivity', ...inactivityEmail('Hakan Temur', unsubSample) },
    { name: 'agent-nudge', ...agentNudgeEmail('Hakan Temur', unsubSample) },
    { name: 'agent-connected', ...agentConnectedEmail('Hakan Temur', unsubSample) },
    { name: 'newsletter', subject: SAMPLE_NEWSLETTER.subject, html: renderNewsletterHtml(SAMPLE_NEWSLETTER, unsubSample) },
  ];

  if (!isMailConfigured() || !process.env.MAIL_TEST_EMAIL) {
    const outDir = path.join(process.cwd(), 'email-previews');
    fs.mkdirSync(outDir, { recursive: true });
    for (const t of templates) {
      fs.writeFileSync(path.join(outDir, `${t.name}.html`), t.html, 'utf8');
    }
    console.log(`Mail env not configured — wrote ${templates.length} previews to ${outDir}`);
    return;
  }

  const to = process.env.MAIL_TEST_EMAIL!;
  for (const t of templates) {
    const res = await sendEmail({
      to,
      userId: null,
      kind: 'test',
      subject: `[TEST ${t.name}] ${t.subject}`,
      html: t.html,
    });
    console.log(`${t.name}: ${res.ok ? 'sent' : `FAILED — ${res.error}`}`);
    await sleep(throttleDelayMs());
  }
  console.log(`Done — check ${to}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
