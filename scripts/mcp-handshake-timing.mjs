#!/usr/bin/env node
// Times the MCP handshake the way Claude Code performs it against a project's Remnus
// bridge: spawn the server from the project's .mcp.json, send `initialize`, then
// `notifications/initialized` and the three list calls together. Each run is a fresh
// process, so every run pays the full start-up cost an agent session pays.
//
//   node scripts/mcp-handshake-timing.mjs --project <dir> [--runs 5] [--bridge mcpjson|local]
//
//   --bridge mcpjson  (default) exactly what the project's .mcp.json says (npx + pin)
//   --bridge local    this repo's cli/bin/remnus.js via plain `node` (no npx)
//
// Read-only: only initialize and list calls are sent. The bridge reads the project's
// token itself; this script never reads or prints it. Timings go to stdout.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const project = path.resolve(opt('project', process.cwd()));
const runs = Number(opt('runs', 5));
const bridge = opt('bridge', 'mcpjson');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function serverCommand() {
  if (bridge === 'local') return { command: process.execPath, args: [path.join(repoRoot, 'cli', 'bin', 'remnus.js'), 'mcp'] };
  const doc = JSON.parse(fs.readFileSync(path.join(project, '.mcp.json'), 'utf8'));
  const entry = doc?.mcpServers?.remnus;
  if (!entry?.command) throw new Error(`No mcpServers.remnus entry in ${project}/.mcp.json`);
  return { command: entry.command, args: entry.args ?? [] };
}

function once({ command, args: cmdArgs }) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const child = spawn(command, cmdArgs, {
      cwd: project,
      stdio: ['pipe', 'pipe', 'pipe'],
      // npx is a .cmd shim on Windows; Claude Code resolves it the same way.
      shell: process.platform === 'win32' && !path.isAbsolute(command),
    });
    const waiting = new Map();
    const marks = {};
    let buf = '';
    let stderr = '';
    const send = (msg) => child.stdin.write(`${JSON.stringify(msg)}\n`);
    const request = (id, method, params = {}) => new Promise((res) => {
      waiting.set(id, res);
      send({ jsonrpc: '2.0', id, method, params });
    });

    child.stderr.on('data', (d) => { stderr += d; });
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        const res = waiting.get(msg.id);
        if (res) { waiting.delete(msg.id); res(msg); }
      }
    });
    child.on('error', reject);
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`timed out; stderr: ${stderr.slice(-400)}`)); }, 60_000);

    (async () => {
      const init = await request(1, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'mcp-handshake-timing', version: '1' },
      });
      marks.initialize = performance.now() - t0;
      if (init.error) throw new Error(`initialize failed: ${init.error.message}`);
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      const tl = performance.now();
      const timed = (p) => p.then((m) => ({ m, ms: performance.now() - tl }));
      const [tools, prompts, resources] = await Promise.all([
        timed(request(2, 'tools/list')),
        timed(request(3, 'prompts/list')),
        timed(request(4, 'resources/list')),
      ]);
      marks.tools = tools.ms;
      marks.prompts = prompts.ms;
      marks.resources = resources.ms;
      marks.total = performance.now() - t0;
      marks.toolCount = tools.m.result?.tools?.length ?? `error: ${tools.m.error?.message}`;
      marks.writeTools = (tools.m.result?.tools ?? []).filter((t) => t.annotations?.readOnlyHint === false).length;
      clearTimeout(timeout);
      child.stdin.end();
      child.kill();
      resolve(marks);
    })().catch((err) => { clearTimeout(timeout); child.kill(); reject(err); });
  });
}

const cmd = serverCommand();
console.log(`project: ${project}`);
console.log(`server:  ${cmd.command} ${cmd.args.join(' ')}`);
console.log('run  initialize   tools/list  prompts/list  resources/list   total   tools(write)');
const rows = [];
for (let i = 1; i <= runs; i++) {
  const m = await once(cmd);
  rows.push(m);
  const f = (v) => `${Math.round(v)}`.padStart(8) + ' ms';
  console.log(`${String(i).padStart(3)} ${f(m.initialize)} ${f(m.tools)} ${f(m.prompts)}   ${f(m.resources)}   ${f(m.total)}   ${m.toolCount}(${m.writeTools})`);
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
console.log(`median initialize ${Math.round(median(rows.map((r) => r.initialize)))} ms, total ${Math.round(median(rows.map((r) => r.total)))} ms`);
