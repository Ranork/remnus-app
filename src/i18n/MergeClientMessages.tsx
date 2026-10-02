'use client';

import { useMemo } from 'react';
import { NextIntlClientProvider, useLocale, useMessages, type AbstractIntlMessages } from 'next-intl';
import { mergeClientMessages } from './pickClientMessages';

/**
 * Adds a scope's messages to the ones its parent provider already holds (V2 R9.1). A
 * nested provider replaces the parent's messages instead of merging, so the merge happens
 * here, on the client — the server sends each namespace once.
 */
export default function MergeClientMessages({ messages, children }: { messages: AbstractIntlMessages; children: React.ReactNode }) {
  const locale = useLocale();
  const parent = useMessages();
  const merged = useMemo(() => mergeClientMessages(parent, messages), [parent, messages]);
  return (
    <NextIntlClientProvider locale={locale} messages={merged}>
      {children}
    </NextIntlClientProvider>
  );
}
