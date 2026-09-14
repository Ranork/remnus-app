import { findProjectRoot, readConfig } from '../lib/project.js';
import { openAppWindow } from '../lib/install.js';
import { bold, detail, fail, ok, say } from '../lib/ui.js';

// Deliberately naive: this does not probe the connection (that's `doctor`'s job).
// `/w/<id>` already redirects to `/login` in that browser if there's no session, and
// to the right workspace once there is — everything past "open this URL" is the web
// app's own auth/access layer, not this command's concern.
export async function openCommand() {
  const root = findProjectRoot(process.cwd());
  const config = readConfig(root);

  if (!config?.workspaceId) {
    fail('This project is not connected to Remnus.');
    detail('Run `npx remnus init` in the project directory.');
    return 1;
  }

  const url = `${config.serverUrl}/w/${config.workspaceId}`;
  say(`${bold('Workspace')} ${config.workspaceName ?? config.workspaceId}`);
  detail(url);

  if (openAppWindow(url)) {
    ok('Opened.');
  } else {
    say('Could not open a browser automatically — open the link above.');
  }
  return 0;
}
