import { Bean } from '../../model';
import { BeansService } from '../../service';
import { BeansTreeDataProvider } from '../BeansTreeDataProvider';

/**
 * Tree provider for active beans (todo and in-progress).
 * Excludes beans whose parent is a draft — those appear in the drafts view instead.
 */
export class ActiveBeansProvider extends BeansTreeDataProvider {
  constructor(service: BeansService) {
    super(service, ['todo', 'in-progress'], false, 'priority-status-type-title');
  }

  protected override async augmentBeans(beans: Bean[]): Promise<Bean[]> {
    // Fetch ALL beans to build a lookup of draft IDs
    const allBeans = await this.service.listBeans();
    const draftIds = new Set(allBeans.filter(b => b.status === 'draft').map(b => b.id));
    const beanById = new Map(allBeans.map(b => [b.id, b]));

    // Exclude active beans whose parent is a draft (direct or transitive)
    return beans.filter(bean => {
      let current: Bean | undefined = bean;
      while (current?.parent) {
        if (draftIds.has(current.parent)) {
          return false;
        }
        current = beanById.get(current.parent);
      }
      return true;
    });
  }
}

/**
 * Tree provider for completed beans
 * Uses flat list since parent beans may not be completed
 */
export class CompletedBeansProvider extends BeansTreeDataProvider {
  constructor(service: BeansService) {
    super(service, ['completed'], true, 'updated');
  }
}

/**
 * Tree provider for scrapped beans
 * Uses flat list since parent beans may not be scrapped
 */
export class ScrappedBeansProvider extends BeansTreeDataProvider {
  constructor(service: BeansService) {
    super(service, ['scrapped'], true, 'updated');
  }
}

/**
 * Tree provider for draft beans.
 * Shows draft beans hierarchically, and also includes non-draft children
 * of draft parents so they nest under the parent in this view.
 */
export class DraftBeansProvider extends BeansTreeDataProvider {
  constructor(service: BeansService) {
    // Fetch drafts via status filter; augmentBeans adds children
    super(service, ['draft']);
  }

  protected override async augmentBeans(beans: Bean[]): Promise<Bean[]> {
    // beans = all draft beans. Now fetch transitive descendants of drafts
    // so the full hierarchy nests under draft roots in this view.
    const includedIds = new Set(beans.map(b => b.id));

    const otherBeans = await this.service.listBeans({
      status: ['todo', 'in-progress', 'completed', 'scrapped'],
    });

    // Build parent→children index for efficient traversal
    const childrenByParent = new Map<string, Bean[]>();
    for (const bean of otherBeans) {
      if (bean.parent) {
        const siblings = childrenByParent.get(bean.parent);
        if (siblings) {
          siblings.push(bean);
        } else {
          childrenByParent.set(bean.parent, [bean]);
        }
      }
    }

    // BFS from each draft root to collect all transitive descendants
    const descendants: Bean[] = [];
    const queue = [...includedIds];
    while (queue.length > 0) {
      const parentId = queue.pop()!;
      const children = childrenByParent.get(parentId);
      if (!children) {
        continue;
      }
      for (const child of children) {
        if (!includedIds.has(child.id)) {
          includedIds.add(child.id);
          descendants.push(child);
          queue.push(child.id);
        }
      }
    }

    return [...beans, ...descendants];
  }
}
