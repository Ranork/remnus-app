'use client';

import { useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';

interface Props {
  user: {
    id: string;
    role: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

export default function PostHogIdentify({ user }: Props) {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;

    if (user) {
      // Identify user in PostHog and attach role & name properties
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        role: user.role, // 'demo' | 'user' | 'admin'
      });
    } else {
      // Clear identity on sign out
      posthog.reset();
    }
  }, [user, posthog]);

  return null;
}
