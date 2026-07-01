'use client';

import { useEffect } from 'react';

/**
 * First-touch channel attribution. On the first landing where a `?ref=` param,
 * UTM params, or a referrer are present, stashes them in a `remnus_first_touch`
 * cookie (90 days, write-once). The signup funnel event reads this cookie
 * server-side, pins it as `$set_once` PostHog person properties AND persists it
 * onto the user row, so both PostHog and the admin dashboard can break new users
 * down by channel (HN / Product Hunt / Reddit / X / a partner `ref=scoutforge` /
 * email / ad …) at the source of first contact.
 */
export default function AttributionCapture() {
  useEffect(() => {
    // First-touch: never overwrite an existing value.
    if (document.cookie.split('; ').some((c) => c.startsWith('remnus_first_touch='))) return;

    const p = new URLSearchParams(window.location.search);
    const data = {
      // Simple partner/campaign tag: `?ref=scoutforge`. Cheap to add to any
      // link (emails, ads, cross-promo) without a full UTM set.
      ref: p.get('ref'),
      utm_source: p.get('utm_source'),
      utm_medium: p.get('utm_medium'),
      utm_campaign: p.get('utm_campaign'),
      referrer: document.referrer || null,
    };

    // Nothing worth attributing (direct, no ref, no UTM, no referrer).
    if (!data.ref && !data.utm_source && !data.utm_medium && !data.utm_campaign && !data.referrer) return;

    const val = encodeURIComponent(JSON.stringify(data));
    document.cookie = `remnus_first_touch=${val}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
  }, []);

  return null;
}
