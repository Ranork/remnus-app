export const runtime = 'edge';

import { getPublicOrigin } from '@/lib/mcp/publicOrigin';

export function GET(req: Request) {
  const base = getPublicOrigin(req);
  return Response.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    },
  );
}
