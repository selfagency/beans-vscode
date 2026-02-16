/**
 * Core Bean model representing a Beans issue/task
 */
export interface Bean {
  /** Full bean ID (e.g., 'beans-vscode-abc1') */
  id: string;

  /** Short code (e.g., 'abc1') */
  code: string;

  /** URL-friendly slug */
  slug: string;

  /** Relative path to bean markdown file */
  path: string;

  /** Bean title */
  title: string;

  /** Markdown content body */
  body: string;

  /** Current status */
  status: BeanStatus;

  /** Bean type */
  type: BeanType;

  /** Optional priority */
  priority?: BeanPriority;

  /** Tags from frontmatter */
  tags: string[];

  /** Parent bean ID if nested */
  parent?: string;

  /** IDs this bean blocks */
  blocking: string[];

  /** IDs blocking this bean */
  blockedBy: string[];

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** ETag for optimistic concurrency control */
  etag: string;
}

/**
 * Bean status values
 */
export type BeanStatus = 'todo' | 'in-progress' | 'completed' | 'scrapped' | 'draft';

/**
 * Bean type values
 */
export type BeanType = 'milestone' | 'epic' | 'feature' | 'bug' | 'task';

/**
 * Bean priority values
 */
export type BeanPriority = 'critical' | 'high' | 'normal' | 'low' | 'deferred';

/**
 * Valid status values as constant array
 */
export const BEAN_STATUSES: readonly BeanStatus[] = ['todo', 'in-progress', 'completed', 'scrapped', 'draft'] as const;

/**
 * Valid type values as constant array
 */
export const BEAN_TYPES: readonly BeanType[] = ['milestone', 'epic', 'feature', 'bug', 'task'] as const;

/**
 * Valid priority values as constant array
 */
export const BEAN_PRIORITIES: readonly BeanPriority[] = ['critical', 'high', 'normal', 'low', 'deferred'] as const;
