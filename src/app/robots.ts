import type { MetadataRoute } from 'next';

// Named for absolute clarity to AI crawlers/agents (GPTBot, ClaudeBot, etc.) —
// the wiki/docs are meant to be read and cited by them, matching the product's
// MCP-native, AI-agent-facing positioning. The `*` group already permits this
// (nothing here is disallowed for everyone else), but naming these bots
// explicitly removes any ambiguity and gives a single place to adjust their
// access independently of the general-crawler rule later.
const PUBLIC_PATHS = ['/', '/pricing', '/contact', '/download', '/privacy', '/security', '/brand', '/wiki', '/docs', '/share/'];
const DISALLOWED_PATHS = ['/app', '/db/', '/page/', '/admin/', '/api/', '/login', '/client-login', '/tauri-app'];

const AI_CRAWLERS = [
  'GPTBot',              // OpenAI training crawler
  'ChatGPT-User',        // OpenAI ChatGPT browsing/plugins
  'OAI-SearchBot',       // OpenAI search
  'ClaudeBot',           // Anthropic training crawler
  'Claude-Web',          // Anthropic browsing
  'anthropic-ai',        // Anthropic (legacy UA)
  'Google-Extended',     // Gemini / Google AI training (separate from Googlebot)
  'PerplexityBot',       // Perplexity search/answers
  'CCBot',               // Common Crawl (widely used as LLM training data)
  'Bytespider',          // ByteDance/TikTok
  'meta-externalagent',  // Meta AI training crawler
  'Applebot-Extended',   // Apple Intelligence training
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: PUBLIC_PATHS, disallow: DISALLOWED_PATHS },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: PUBLIC_PATHS, disallow: DISALLOWED_PATHS })),
    ],
    sitemap: 'https://remnus.com/sitemap.xml',
  };
}
