import * as vscode from 'vscode';
import { BEAN_PRIORITIES, BEAN_STATUSES, BEAN_TYPES } from '../model';
import { BeansFilterState } from '../tree/BeansFilterManager';

type SearchFilterGroup = 'status' | 'type' | 'priority';
type SearchFilterItem = vscode.QuickPickItem & { group?: SearchFilterGroup; value?: string };

const STATUS_LABELS: Record<string, string> = {
  todo: '$(issues) Todo',
  'in-progress': '$(play-circle) In Progress',
  completed: '$(issue-closed) Completed',
  draft: '$(issue-draft) Draft',
  scrapped: '$(stop) Scrapped',
};

const TYPE_LABELS: Record<string, string> = {
  task: '$(list-unordered) Task',
  bug: '$(bug) Bug',
  feature: '$(lightbulb) Feature',
  epic: '$(zap) Epic',
  milestone: '$(milestone) Milestone',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: '$(circle-large-filled) Critical',
  high: '$(circle-large-filled) High',
  normal: '$(circle-large-filled) Normal',
  low: '$(circle-large-filled) Low',
  deferred: '$(circle-large-filled) Deferred',
};

function prettyLabel(group: SearchFilterGroup, value: string): string {
  if (group === 'status') {
    return STATUS_LABELS[value] ?? value;
  }
  if (group === 'type') {
    return TYPE_LABELS[value] ?? value;
  }
  return PRIORITY_LABELS[value] ?? value;
}

function buildSearchFilterItems(): vscode.QuickPickItem[] {
  const groups: Array<{ group: SearchFilterGroup; values: readonly string[] }> = [
    { group: 'status', values: BEAN_STATUSES },
    { group: 'type', values: BEAN_TYPES },
    { group: 'priority', values: BEAN_PRIORITIES },
  ];

  const items: SearchFilterItem[] = [];
  for (const group of groups) {
    for (const value of group.values) {
      items.push({
        label: prettyLabel(group.group, value),
        group: group.group,
        value,
      });
    }
  }
  return items;
}

function buildPreselectedSearchFilterItems(items: SearchFilterItem[], state: BeansFilterState): SearchFilterItem[] {
  const selected = new Set<string>();
  for (const value of state.statuses || []) {
    selected.add(value);
  }
  for (const value of state.types || []) {
    selected.add(value);
  }
  for (const value of state.priorities || []) {
    selected.add(value);
  }
  return items.filter(item => !!item.value && selected.has(item.value));
}

async function pickSearchFilterItems(
  items: SearchFilterItem[],
  selectedItems: SearchFilterItem[]
): Promise<SearchFilterItem[] | undefined> {
  const qp = vscode.window.createQuickPick<SearchFilterItem>();
  qp.canSelectMany = true;
  qp.title = 'Filter Search Results';
  qp.items = items;
  qp.selectedItems = selectedItems;

  const pickedItems = await new Promise<SearchFilterItem[] | undefined>(resolve => {
    qp.onDidAccept(() => resolve(Array.from(qp.selectedItems)));
    qp.onDidHide(() => resolve(undefined));
    qp.show();
  });
  qp.dispose();
  return pickedItems;
}

function mapPickedItemsToFilterState(pickedItems: SearchFilterItem[]): BeansFilterState {
  const result: BeansFilterState = {};
  for (const pickedItem of pickedItems) {
    const group = pickedItem.group;
    const value = pickedItem.value;
    if (!value) {
      continue;
    }
    if (group === 'status') {
      result.statuses = result.statuses || [];
      result.statuses.push(value);
    } else if (group === 'type') {
      result.types = result.types || [];
      result.types.push(value);
    } else if (group === 'priority') {
      result.priorities = result.priorities || [];
      result.priorities.push(value);
    }
  }
  return result;
}

export function sanitizeSearchFilterState(current?: BeansFilterState): BeansFilterState {
  if (!current) {
    return {};
  }

  const normalized: BeansFilterState = {};

  if (typeof current.text === 'string') {
    const text = current.text.trim();
    if (text.length > 0) {
      normalized.text = text;
    }
  }

  if (Array.isArray(current.tags)) {
    const filteredTags = current.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
    if (filteredTags.length > 0) {
      normalized.tags = filteredTags;
    }
  }

  if (Array.isArray(current.statuses)) {
    const allowedStatuses = new Set<string>(BEAN_STATUSES as readonly string[]);
    const filteredStatuses = current.statuses.filter(
      (s): s is string => typeof s === 'string' && allowedStatuses.has(s)
    );
    if (filteredStatuses.length > 0) {
      normalized.statuses = filteredStatuses;
    }
  }

  if (Array.isArray(current.types)) {
    const allowedTypes = new Set<string>(BEAN_TYPES as readonly string[]);
    const filteredTypes = current.types.filter((t): t is string => typeof t === 'string' && allowedTypes.has(t));
    if (filteredTypes.length > 0) {
      normalized.types = filteredTypes;
    }
  }

  if (Array.isArray(current.priorities)) {
    const allowedPriorities = new Set<string>(BEAN_PRIORITIES as readonly string[]);
    const filteredPriorities = current.priorities.filter(
      (p): p is string => typeof p === 'string' && allowedPriorities.has(p)
    );
    if (filteredPriorities.length > 0) {
      normalized.priorities = filteredPriorities;
    }
  }

  return normalized;
}

export async function showSearchFilterUI(current?: BeansFilterState): Promise<BeansFilterState | undefined> {
  const normalizedCurrent = sanitizeSearchFilterState(current);
  const items = buildSearchFilterItems();
  const selectedItems = buildPreselectedSearchFilterItems(items, normalizedCurrent);
  const picked = await pickSearchFilterItems(items, selectedItems);

  if (!picked) {
    return undefined;
  }

  const pickedFilter = mapPickedItemsToFilterState(picked);
  const merged: BeansFilterState = {
    ...normalizedCurrent,
    ...pickedFilter,
    // This UI edits only status/type/priority; preserve text and tags.
    text: normalizedCurrent.text,
    tags: normalizedCurrent.tags,
  };

  return sanitizeSearchFilterState(merged);
}
