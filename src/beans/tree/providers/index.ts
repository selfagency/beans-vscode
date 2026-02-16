import { BeansTreeDataProvider } from '../BeansTreeDataProvider';
import { BeansService } from '../../service';

/**
 * Tree provider for active beans (todo and in-progress)
 */
export class ActiveBeansProvider extends BeansTreeDataProvider {
	constructor(service: BeansService) {
		super(service, ['todo', 'in-progress']);
	}
}

/**
 * Tree provider for completed beans
 */
export class CompletedBeansProvider extends BeansTreeDataProvider {
	constructor(service: BeansService) {
		super(service, ['completed']);
	}
}

/**
 * Tree provider for draft beans
 */
export class DraftBeansProvider extends BeansTreeDataProvider {
	constructor(service: BeansService) {
		super(service, ['draft']);
	}
}

/**
 * Tree provider for scrapped beans
 */
export class ScrappedBeansProvider extends BeansTreeDataProvider {
	constructor(service: BeansService) {
		super(service, ['scrapped']);
	}
}

/**
 * Tree provider for archived beans
 * Note: Beans CLI may not have explicit archive support yet,
 * so this may show old completed/scrapped items or be empty
 */
export class ArchivedBeansProvider extends BeansTreeDataProvider {
	constructor(service: BeansService) {
		// For now, archived view shows all statuses
		// This can be refined once archive functionality is clarified
		super(service);
	}
}
