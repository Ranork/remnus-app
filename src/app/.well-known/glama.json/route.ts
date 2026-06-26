export const runtime = 'edge';

// Glama MCP connector ownership verification.
// Glama fetches https://www.remnus.com/.well-known/glama.json and matches the
// maintainer email against the claiming Glama account to grant admin controls
// over the Remnus connector listing.
export function GET() {
  return Response.json(
    {
      $schema: 'https://glama.ai/mcp/schemas/connector.json',
      maintainers: [{ email: 'ranorkk@gmail.com' }],
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    },
  );
}
