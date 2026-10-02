import { getMessages } from 'next-intl/server';
import { CLIENT_NAMESPACES, type ClientScope } from './clientNamespaces';
import { pickClientMessages } from './pickClientMessages';
import MergeClientMessages from './MergeClientMessages';

/**
 * Sends a route scope's client messages (V2 R9.1). The locale layout's provider holds
 * only the `root` namespaces; a layout whose client components need more wraps its tree
 * in this. The lists are generated — `npm run test:i18n-client` fails when a scope is not
 * wrapped or a list is stale.
 */
export default async function ClientMessages({ scope, children }: { scope: ClientScope; children: React.ReactNode }) {
  const messages = pickClientMessages(await getMessages(), CLIENT_NAMESPACES[scope]);
  return <MergeClientMessages messages={messages}>{children}</MergeClientMessages>;
}
