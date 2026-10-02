import type { AbstractIntlMessages } from 'next-intl';

type Messages = Record<string, unknown>;

/**
 * The part of the catalogue a client scope needs (V2 R9.1). `entries` come from
 * `clientNamespaces.ts`: 'Ns' is a whole namespace, 'Ns.prefix*' only the keys of Ns
 * that start with prefix.
 */
export function pickClientMessages(all: AbstractIntlMessages, entries: readonly string[]): AbstractIntlMessages {
  const source = all as Messages;
  const out: Messages = {};
  for (const entry of entries) {
    if (!entry.endsWith('*')) {
      if (entry in source) out[entry] = source[entry];
      continue;
    }
    const dot = entry.indexOf('.');
    const ns = entry.slice(0, dot);
    const prefix = entry.slice(dot + 1, -1);
    const whole = source[ns];
    if (!whole || typeof whole !== 'object' || out[ns] === whole) continue;
    const target = (out[ns] ??= {}) as Messages;
    for (const [key, value] of Object.entries(whole)) if (key.startsWith(prefix)) target[key] = value;
  }
  return out as AbstractIntlMessages;
}

/** Parent scope's messages plus a child scope's, namespace by namespace. */
export function mergeClientMessages(parent: AbstractIntlMessages, own: AbstractIntlMessages): AbstractIntlMessages {
  const merged: Messages = { ...(parent as Messages) };
  for (const [ns, value] of Object.entries(own as Messages)) {
    const prev = merged[ns];
    merged[ns] = prev && typeof prev === 'object' && typeof value === 'object' ? { ...(prev as Messages), ...(value as Messages) } : value;
  }
  return merged as AbstractIntlMessages;
}
