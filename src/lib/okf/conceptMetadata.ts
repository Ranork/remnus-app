import { parseOkfFrontmatter, splitTopLevelEntries } from './frontmatter';

export type ConceptTrust = 'human-reviewed' | 'external-human-asserted' | 'machine-confirmed' | 'unverified' | 'unspecified';

export interface ConceptMetadata {
  type?: string;
  status?: string;
  staleAfter?: string;
  stale: boolean;
  trust: ConceptTrust;
  hasSources: boolean;
  hasGeneratedProvenance: boolean;
}

interface SchemaColumn {
  id?: string;
  name?: string;
  type?: string;
}

function valuesByName(schema: unknown[], properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...properties };
  for (const raw of schema) {
    const column = raw as SchemaColumn;
    if (column.id && column.name && Object.hasOwn(properties, column.id)) result[column.name] = properties[column.id];
  }
  return result;
}

export function inspectConceptMetadata(
  properties: Record<string, unknown> | undefined,
  schema: unknown[] = [],
  now = new Date(),
): ConceptMetadata {
  if (!properties) {
    return { stale: false, trust: 'unspecified', hasSources: false, hasGeneratedProvenance: false };
  }

  const named = valuesByName(schema, properties);
  const raw = Object.entries(named).find(([key, value]) =>
    key.toLowerCase().includes('frontmatter') && typeof value === 'string',
  )?.[1];
  const parsed = typeof raw === 'string' ? parseOkfFrontmatter(raw) : undefined;
  const entries = typeof raw === 'string' ? splitTopLevelEntries(raw) : [];
  const verified = entries.find(entry => entry.key === 'verified')?.block;

  const scalarValues = Object.values(named).filter((value): value is string => typeof value === 'string');
  const trustValue = scalarValues.find(value => ['human-reviewed', 'machine-confirmed', 'unverified'].includes(value.toLowerCase()))?.toLowerCase();
  // Imported OKF is data supplied by an external bundle. A `human:*` assertion
  // is useful provenance, but it is not an authenticated Remnus review. Native
  // reviews are stored separately and bound to the exact content hash.
  const trust: ConceptTrust = verified && /["']?by["']?\s*:\s*["']?human:/m.test(verified)
    ? 'external-human-asserted'
    : verified
      ? 'machine-confirmed'
      : trustValue === 'human-reviewed' || trustValue === 'machine-confirmed' || trustValue === 'unverified'
        ? trustValue
        : typeof raw === 'string'
          ? 'unverified'
          : 'unspecified';

  const staleAfter = parsed?.staleAfter;
  const staleAt = staleAfter ? new Date(staleAfter) : null;
  return {
    type: parsed?.type,
    status: parsed?.status,
    staleAfter,
    stale: !!staleAt && Number.isFinite(staleAt.getTime()) && staleAt.getTime() < now.getTime(),
    trust,
    hasSources: entries.some(entry => entry.key === 'sources'),
    hasGeneratedProvenance: entries.some(entry => entry.key === 'generated'),
  };
}
