#!/usr/bin/env node
import { run } from '../src/cli.js';

run(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`remnus: ${err?.message ?? err}\n`);
  process.exit(1);
});
