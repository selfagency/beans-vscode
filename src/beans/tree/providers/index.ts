import { BeansService } from '../../service';
import { BeansTreeDataProvider } from '../BeansTreeDataProvider';

/**
 * Tree provider for active beans (todo and in-progress)
 * Uses hierarchical display since both statuses are in the same set
 */
export class ActiveBeansProvider extends BeansTreeDataProvider {
  constructor(service: BeansService) {
    super(service, ['todo', 'in-progress']);
  }
}

/**
 * Tree provider for completed beans
 * Uses flat list since parent beans may not be completed
 */
export class CompletedBeansProvider extends BeansTreeDataProvider {
  constructor(service: BeansService) {
    super(service, ['completed'], true);
  }
}

/**
 * Tree provider for draft beans
 * Uses flat list since parent beans may not be drafts
 */
export class DraftBeansProvider extends BeansTreeDataProvider {
  constructor(service: BeansService) {
    super(service, ['draft'], true);
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
