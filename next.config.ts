import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from '@ducanh2912/next-pwa';
import { withPostHogConfig } from '@posthog/nextjs-config';
import { getAllowedDevOrigins } from './src/lib/nextDevOrigins';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  // Raise the Next.js proxy body limit for /api/upload (kind=file accepts up to
  // 25 MB attachments). The Notion import route receives only a JSON payload —
  // the ZIP is parsed entirely in the browser and never sent to the server.
  experimental: {
    proxyClientMaxBodySize: '30mb',
  },
};

const intlConfig = withNextIntl(nextConfig);

// Only apply the PWA wrapper in production so Turbopack runs unobstructed in dev.
// withPWA injects webpack plugins even when `disable: true`, which prevents
// Next.js from selecting Turbopack and causes significantly slower recompilation.
const prodConfig = process.env.NODE_ENV === 'production'
  ? withPWAInit({
      dest: 'public',
      cacheOnFrontEndNav: true,
      reloadOnOnline: true,
      workboxOptions: { disableDevLogs: true },
    })(intlConfig)
  : intlConfig;

// PostHog source-map upload: generates hidden browser source maps during the
// production build, uploads them to PostHog Error Tracking (so minified stacks
// like React #310 resolve to real component/file/line), then deletes them so
// they never ship to end users. Gated on the build-time creds being present —
// without them (local builds, forks) the build runs untouched. EU cloud, so the
// API host is eu.posthog.com (NOT the eu.i.posthog.com INGEST host).
const phApiKey = process.env.POSTHOG_API_KEY;
const phProjectId = process.env.POSTHOG_PROJECT_ID;

export default process.env.NODE_ENV === 'production' && phApiKey && phProjectId
  ? withPostHogConfig(prodConfig, {
      personalApiKey: phApiKey,
      projectId: phProjectId,
      host: 'https://eu.posthog.com',
      sourcemaps: { deleteAfterUpload: true },
    })
  : prodConfig;
