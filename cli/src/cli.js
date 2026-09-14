import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initCommand } from './commands/init.js';
import { mcpCommand } from './commands/mcp.js';
import { doctorCommand } from './commands/doctor.js';
import { openCommand } from './commands/open.js';
import { bold, dim, say } from './lib/ui.js';

const PKG = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
);

const FLAGS_WITH_VALUES = new Set(['--server', '--dir']);

function parseArgs(argv) {
  const options = { oauth: false, http: false, noBrowser: false, server: null, dir: null };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (FLAGS_WITH_VALUES.has(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) throw new Error(`${arg} needs a value.`);
      options[arg.slice(2)] = value;
      i += 1;
      continue;
    }

    if (arg === '--oauth') { options.oauth = true; continue; }
    if (arg === '--http') { options.http = true; continue; }
    if (arg === '--no-browser') { options.noBrowser = true; continue; }
    if (arg === '--help' || arg === '-h') { positional.push('help'); continue; }
    if (arg === '--version' || arg === '-v') { positional.push('version'); continue; }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);

    positional.push(arg);
  }

  return { command: positional[0] ?? 'help', options };
}

function printHelp() {
  say();
  say(`${bold('remnus')} ${dim(`v${PKG.version}`)}`);
  say(dim('Set up Remnus in a project: one command, one sign-in, one workspace.'));
  say();
  say(bold('Commands'));
  say('  init      Connect this project to a Remnus workspace');
  say('  open      Open this project\'s workspace in your browser');
  say('  doctor    Check whether the connection still works');
  say('  mcp       Run the MCP server (your .mcp.json calls this)');
  say();
  say(bold('Options'));
  say('  --oauth          Let the agent sign in itself; store no token in the project');
  say('  --http           Write a direct HTTP endpoint into .mcp.json instead of this CLI');
  say('  --no-browser     Print the sign-in link instead of opening a browser');
  say('  --server <url>   Use a self-hosted Remnus instance');
  say('  --dir <path>     Set up a different directory than the current one');
  say();
  say(dim('Docs: https://remnus.com/wiki/project-install'));
  say();
}

export async function run(argv) {
  const { command, options } = parseArgs(argv);

  switch (command) {
    case 'init':
      await initCommand(options);
      return;

    case 'mcp':
      await mcpCommand();
      return;

    case 'open':
      process.exitCode = await openCommand();
      return;

    case 'doctor':
      process.exitCode = await doctorCommand();
      return;

    case 'version':
      say(PKG.version);
      return;

    case 'help':
      printHelp();
      return;

    default:
      throw new Error(`Unknown command: ${command}. Run \`remnus help\` to see what is available.`);
  }
}
