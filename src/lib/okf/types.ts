export const OKF_VERSION = '0.2' as const;
export const REMNUS_OKF_PROFILE_VERSION = 1 as const;

export type OkfSubjectKind = 'page' | 'database' | 'database_row';

export interface OkfWorkspaceItemSnapshot {
  id: string;
  type: 'page' | 'database';
  title: string;
  parentId: string | null;
  sortOrder: number;
  icon: string | null;
  iconColor: string | null;
  updatedAt: string | null;
}

export interface OkfStandalonePageSnapshot {
  itemId: string;
  content: string;
  updatedAt: string | null;
}

export interface OkfDatabaseRowSnapshot {
  id: string;
  databaseId: string;
  title: string;
  content: string;
  properties: Record<string, unknown>;
  sortOrder: number;
  icon: string | null;
  iconColor: string | null;
  updatedAt: string | null;
}

export interface OkfDatabaseSnapshot {
  id: string;
  itemId: string;
  name: string;
  schema: unknown[];
  views: unknown[];
  updatedAt: string | null;
  rows: OkfDatabaseRowSnapshot[];
}

export interface OkfWorkspaceSnapshot {
  workspace: {
    id: string;
    name: string;
    updatedAt: string | null;
  };
  items: OkfWorkspaceItemSnapshot[];
  standalonePages: OkfStandalonePageSnapshot[];
  databases: OkfDatabaseSnapshot[];
  knowledge: Array<{
    itemId: string;
    itemType: OkfSubjectKind;
    conceptType?: string;
    description?: string;
    tags: string[];
    sources: Array<{ resource: string; title?: string }>;
    status?: 'draft' | 'stable' | 'deprecated';
    staleAfter?: string;
    trust: 'human-reviewed' | 'external-human-asserted' | 'machine-confirmed' | 'unverified';
    generatedBy?: string;
    reviewedAt?: string;
  }>;
}

export interface OkfBundleFile {
  path: string;
  content: string;
  sha256: string;
  kind: 'concept' | 'index' | 'log' | 'manifest' | 'report';
}

export interface OkfValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  path?: string;
  message: string;
}

export interface OkfValidationReport {
  version: typeof OKF_VERSION;
  valid: boolean;
  conceptCount: number;
  issues: OkfValidationIssue[];
}

export interface OkfBundle {
  rootName: string;
  files: OkfBundleFile[];
  report: OkfValidationReport;
  manifest: {
    format: 'remnus-okf-knowledge-pack';
    profileVersion: typeof REMNUS_OKF_PROFILE_VERSION;
    okfVersion: typeof OKF_VERSION;
    exportedAt: string;
    workspace: { id: string; name: string };
    counts: { pages: number; databases: number; rows: number; concepts: number };
    fidelity: {
      content: 'standard-markdown';
      internalLinks: 'rewritten-to-bundle-absolute-links';
      assets: 'linked-not-embedded';
      databaseSchema: 'preserved-in-remnus-extension';
      databaseViews: 'preserved-in-remnus-extension';
    };
    files: Array<{ path: string; sha256: string; kind: OkfBundleFile['kind'] }>;
  };
}

export interface ParsedOkfFrontmatter {
  raw: string;
  type?: string;
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  status?: string;
  staleAfter?: string;
}

export interface ParsedOkfConcept {
  path: string;
  title: string;
  type: string;
  content: string;
  frontmatterRaw: string;
  description?: string;
  resource?: string;
  tags: string[];
  status?: string;
  staleAfter?: string;
  trustTier: 'unverified' | 'machine-confirmed' | 'external-human-asserted';
}

export interface OkfImportPreview {
  bundleName: string;
  version: string | null;
  concepts: ParsedOkfConcept[];
  stats: {
    concepts: number;
    indexes: number;
    logs: number;
    assets: number;
    brokenLinks: number;
    executableConcepts: number;
  };
  issues: OkfValidationIssue[];
}
