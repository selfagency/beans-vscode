import { Bean } from '../../model';
import { BeansService } from '../../service';
import { BeansTreeDataProvider } from '../BeansTreeDataProvider';

/**
 * Tree provider for active beans (todo and in-progress).
 * Excludes beans whose parent is a draft — those appear in the drafts view instead.
 */
export class ActiveBeansProvider extends BeansTreeDataProvider {
  constructor(service: BeansService) {
    super(service, ['todo', 'in-progress']);
  }

  protected override async augmentBeans(beans: Bean[]): Promise<Bean[]> {
    // Fetch ALL beans to build a lookup of draft IDs
    const allBeans = await this.service.listBeans();
    const draftIds = new Set(allBeans.filter((b) => b.status === 'draft').map((b) => b.id));

    // Exclude active beans whose parent is a draft (direct or transitive)
    return beans.filter((bean) => {
      let current: Bean | undefined = bean;
      while (current?.parent) {
        if (draftIds.has(current.parent)) {
          return false;
        }
        current = allBeans.find((b) => b.id === current!.parent);
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
    // beans = all draft beans. Now fetch children of drafts that aren't drafts themselves.
    const draftIds = new Set(beans.map((b) => b.id));

    // Fetch active + completed + scrapped beans to find children of drafts
    const otherBeans = await this.service.listBeans({
      status: ['todo', 'in-progress', 'completed', 'scrapped']
    });

    const childrenOfDrafts = otherBeans.filter((b) => b.parent && draftIds.has(b.parent));

    return [...beans, ...childrenOfDrafts];
  }
}

/**
 * Tree provider for scrapped beans
 * Uses flat list since parent beans may not be scrapped
 */
export class ScrappedBeansProvider extends BeansTreeDataProvider {
  constructor(service: BeansService) {
    super(service, ['scrapped'], true);
  }
}
