export type SortMode = 'status-priority-type-title' | 'updated' | 'created' | 'id';

function sortBeansInternal(beans: any[], mode: SortMode): any[] {
  const sorted = [...beans];
  const statusWeight: Record<string, number> = {
    'in-progress': 0,
    todo: 1,
    draft: 2,
    completed: 3,
    scrapped: 4,
  };
  const priorityWeight: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
    deferred: 4,
  };
  const typeWeight: Record<string, number> = {
    milestone: 0,
    epic: 1,
    feature: 2,
    bug: 3,
    task: 4,
  };

  if (mode === 'updated') {
    return sorted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  if (mode === 'created') {
    return sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  if (mode === 'id') {
    return sorted.sort((a, b) => a.id.localeCompare(b.id));
  }

  return sorted.sort((a, b) => {
    const statusCmp = (statusWeight[a.status] ?? 99) - (statusWeight[b.status] ?? 99);
    if (statusCmp !== 0) {
      return statusCmp;
    }

    const aPriority = a.priority || 'normal';
    const bPriority = b.priority || 'normal';
    const priorityCmp = (priorityWeight[aPriority] ?? 99) - (priorityWeight[bPriority] ?? 99);
    if (priorityCmp !== 0) {
      return priorityCmp;
    }

    const typeCmp = (typeWeight[a.type] ?? 99) - (typeWeight[b.type] ?? 99);
    if (typeCmp !== 0) {
      return typeCmp;
    }

    return a.title.localeCompare(b.title);
  });
}

import { buildBeansCopilotInstructions } from '../../config/CopilotInstructions';

export async function handleQueryOperation(
  backend: any,
  params: {
    operation: string;
    mode?: SortMode;
    statuses?: string[] | null;
    types?: string[] | null;
    search?: string;
    tags?: string[] | null;
    writeToWorkspaceInstructions?: boolean;
    includeClosed?: boolean;
  }
) {
  const { operation, mode, statuses, types, search, tags, writeToWorkspaceInstructions, includeClosed } = params;

  if (operation === 'llm_context') {
    const graphqlSchema = await backend.graphqlSchema();
    const generatedInstructions = buildBeansCopilotInstructions(graphqlSchema);
    const instructionsPath = writeToWorkspaceInstructions
      ? await backend.writeInstructions(generatedInstructions)
      : null;
    return {
      content: [
        { type: 'text', text: JSON.stringify({ graphqlSchema, generatedInstructions, instructionsPath }, null, 2) },
      ],
      structuredContent: { graphqlSchema, generatedInstructions, instructionsPath },
    };
  }

  if (operation === 'open_config') {
    const config = await backend.openConfig();
    return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }], structuredContent: config };
  }

  const normalizedStatuses = Array.isArray(statuses) ? statuses : undefined;
  const normalizedTypes = Array.isArray(types) ? types : undefined;

  if (operation === 'refresh') {
    const beans = await backend.list();
    return {
      content: [{ type: 'text', text: JSON.stringify({ count: beans.length, beans }, null, 2) }],
      structuredContent: { count: beans.length, beans },
    };
  }

  if (operation === 'filter') {
    let beans = await backend.list({ status: normalizedStatuses, type: normalizedTypes, search });
    if (Array.isArray(tags) && tags.length > 0) {
      const tagSet = new Set(tags);
      beans = beans.filter((bean: any) => (bean.tags || []).some((tag: string) => tagSet.has(tag)));
    }
    return {
      content: [{ type: 'text', text: JSON.stringify({ count: beans.length, beans }, null, 2) }],
      structuredContent: { count: beans.length, beans },
    };
  }

  if (operation === 'search') {
    let beans = await backend.list({ search });
    // Ensure robust search behavior even if backend.list ignores the `search` param.
    if (typeof search === 'string' && search.length > 0) {
      const q = search.toLowerCase();
      beans = beans.filter((b: any) => {
        const title = (b.title || '').toLowerCase();
        const id = (b.id || '').toLowerCase();
        const tags = (b.tags || []).join(' ').toLowerCase();
        return title.includes(q) || id.includes(q) || tags.includes(q);
      });
    }
    if (includeClosed === false) {
      beans = beans.filter((b: any) => b.status !== 'completed' && b.status !== 'scrapped');
    }
    return {
      content: [{ type: 'text', text: JSON.stringify({ query: search, count: beans.length, beans }, null, 2) }],
      structuredContent: { query: search, count: beans.length, beans },
    };
  }

  // sort
  const beans = await backend.list({ status: normalizedStatuses, type: normalizedTypes, search });
  const sorted = sortBeansInternal(beans, (mode as any) || 'status-priority-type-title');
  return {
    content: [{ type: 'text', text: JSON.stringify({ mode, count: beans.length, beans: sorted }, null, 2) }],
    structuredContent: { mode, count: beans.length, beans: sorted },
  };
}

export { sortBeansInternal as sortBeans };
