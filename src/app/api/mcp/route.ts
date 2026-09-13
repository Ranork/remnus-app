export const runtime = 'nodejs';
export const maxDuration = 60;

import { handleMcpGet, handleMcpRequest } from './handler';

// Workspace-agnostic endpoint: the bearer token alone picks the workspace.
// Kept as-is for every already-connected client. New per-project installs get
// the workspace-pinned URL instead — see ./w/[workspaceId]/route.ts.
export async function POST(req: Request) { return handleMcpRequest(req); }
export async function DELETE(req: Request) { return handleMcpRequest(req); }
export async function GET(req: Request) { return handleMcpGet(req); }
