/**
 * Beans search components
 * @module beans/search
 */

export { BeansSearchTreeProvider } from './BeansSearchTreeProvider';
// The `BeansSearchViewProvider` class (webview-based search) is retained in
// source for reference but is not currently instantiated by the extension
// activation path. The tree-based search (`BeansSearchTreeProvider`) supersedes
// it. Keep this export removed to avoid exposing dead code; if you intentionally
// want to re-enable the old webview provider, remove this comment and re-export
// the class here. See bean `beans-vscode-l7wv` for the decision record.
// export { BeansSearchViewProvider } from './BeansSearchViewProvider';
export { sanitizeSearchFilterState, showSearchFilterUI } from './SearchFilterUI';
