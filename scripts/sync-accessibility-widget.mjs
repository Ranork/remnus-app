import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = path.resolve(
  process.env.ACCESSIBILITY_WIDGET_SOURCE ||
    path.join(projectRoot, '..', 'accessibility-preference-widget-public'),
);
const vendorRoot = path.join(
  projectRoot,
  'public',
  'vendor',
  'accessibility-preference-widget',
);
const npmCli = process.env.npm_execpath;

if (!fs.existsSync(path.join(sourceRoot, 'package.json'))) {
  throw new Error(
    `Accessibility widget source was not found at ${sourceRoot}. ` +
      'Set ACCESSIBILITY_WIDGET_SOURCE to the public repository path.',
  );
}

if (!npmCli) {
  throw new Error('npm_execpath is unavailable. Run this script through npm.');
}

const build = spawnSync(process.execPath, [npmCli, 'run', 'build'], {
  cwd: sourceRoot,
  encoding: 'utf8',
  stdio: 'inherit',
});

if (build.error) throw build.error;
if (build.status !== 0) {
  throw new Error(`Accessibility widget build failed with exit code ${build.status}.`);
}

fs.mkdirSync(path.join(vendorRoot, 'licenses'), { recursive: true });

const copy = (source, destination) => {
  fs.copyFileSync(path.join(sourceRoot, source), path.join(vendorRoot, destination));
};

copy('dist/widget.min.js', 'widget.min.js');
copy('dist/widget.min.js.map', 'widget.min.js.map');
copy('dist/integrity.json', 'integrity.json');
copy('LICENSE', 'LICENSE.txt');
copy('THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md');
copy('licenses/Apache-2.0.txt', 'licenses/Apache-2.0.txt');
copy(
  'licenses/Lucide-ISC-and-Feather-MIT.txt',
  'licenses/Lucide-ISC-and-Feather-MIT.txt',
);

process.stdout.write(`Accessibility widget assets updated from ${sourceRoot}\n`);
