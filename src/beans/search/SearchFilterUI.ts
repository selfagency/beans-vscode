import * as vscode from 'vscode';
import { BEAN_PRIORITIES, BEAN_STATUSES, BEAN_TYPES } from '../model';
import { BeansFilterState } from '../tree/BeansFilterManager';

type SearchFilterGroup = 'status' | 'type' | 'priority';

function buildSearchFilterItems(): vscode.QuickPickItem[] {
  const groups: Array<{ title: string; description: SearchFilterGroup; values: readonly string[] }> = [
    { title: 'Status', description: 'status', values: BEAN_STATUSES },
    { title: 'Type', description: 'type', values: BEAN_TYPES },
    { title: 'Priority', description: 'priority', values: BEAN_PRIORITIES },
  ];

  const items: vscode.QuickPickItem[] = [];
  for (const group of groups) {
    items.push({ kind: vscode.QuickPickItemKind.Separator, label: group.title } as vscode.QuickPickItem);
    for (const value of group.values) {
      items.push({ label: value, description: group.description });
    }
  }
  return items;
}

function buildPreselectedSearchFilterItems(
  items: vscode.QuickPickItem[],
  state: BeansFilterState
): vscode.QuickPickItem[] {
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
  return items.filter(item => selected.has(item.label));
}

async function pickSearchFilterItems(
  items: vscode.QuickPickItem[],
  selectedItems: vscode.QuickPickItem[]
): Promise<vscode.QuickPickItem[] | undefined> {
  const qp = vscode.window.createQuickPick<vscode.QuickPickItem>();
  qp.canSelectMany = true;
  qp.title = 'Filter Search Results';
  qp.items = items;
  qp.selectedItems = selectedItems;

  const pickedItems = await new Promise<vscode.QuickPickItem[] | undefined>(resolve => {
    qp.onDidAccept(() => resolve(Array.from(qp.selectedItems)));
    qp.onDidHide(() => resolve(undefined));
    qp.show();
  });
  qp.dispose();
  return pickedItems;
}

function mapPickedItemsToFilterState(pickedItems: vscode.QuickPickItem[]): BeansFilterState {
  const result: BeansFilterState = {};
  for (const pickedItem of pickedItems) {
    const group = pickedItem.description as SearchFilterGroup | undefined;
    if (group === 'status') {
      result.statuses = result.statuses || [];
      result.statuses.push(pickedItem.label);
    } else if (group === 'type') {
      result.types = result.types || [];
      result.types.push(pickedItem.label);
    } else if (group === 'priority') {
      result.priorities = result.priorities || [];
      result.priorities.push(pickedItem.label);
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

  return sanitizeSearchFilterState(mapPickedItemsToFilterState(picked));
}
