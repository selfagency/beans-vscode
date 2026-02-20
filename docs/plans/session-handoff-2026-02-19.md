1. Find/create tracking bean

Search for an existing bean covering this simplification work
If none exists, create one and set it in-progress
Create a branch feature/<id>-simplify-quarantine-orphan if needed (already on feature/92i0-priority-icons which relates to something else) 2. Remove placeholder methods from BeansService.ts (lines 911–1051)

Delete inferPlaceholderType (~911–927)
Delete buildRecoveredBeanBody (~928–947)
Delete createPlaceholdersForQuarantinedBeans (~950–1051) — the entire method including its fallback orphan-clear block 3. Add orphanChildrenOfQuarantinedBeans to BeansService.ts

New private method: for each quarantined ID, find children where child.parent === quarantinedId, call UPDATE_BEAN_MUTATION with { id: child.id, input: { parent: '' } }, replace in normalizedBeans
Notify once with a warning listing which children were orphaned (code list) and which file was quarantined (link)
This should be strictly simpler than the placeholder method (~30 lines vs ~100) 4. Update the listBeans call site (lines 544–549)

Replace: await this.createPlaceholdersForQuarantinedBeans(normalizedBeans, quarantinedPaths)
With: await this.orphanChildrenOfQuarantinedBeans(normalizedBeans, quarantinedPaths)
Remove the if (quarantinedPaths.size > 0) guard (the new method can handle empty internally, or keep guard — consistent with existing style) 5. Update deleteBean in BeansCommands.ts (line 1173)

After resolving the bean and checking scrapped/draft status, call service.listBeans() and filter for bean.parent === bean.id to find children
If children exist, show a modal with three buttons: Delete All / Delete Parent Only / Cancel
Delete All: delete each child first, then delete parent
Delete Parent Only: orphan children (updateBean(child.id, { clearParent: true }) for each), then delete parent
Cancel: abort
If no children, existing behaviour (single confirm dialog) is fine as-is — keep it unchanged 6. Update BeansService.test.ts (around line 566)

Remove the it('creates placeholder parent for children of a quarantined bean', ...) test (~566–649)
Add replacement test: it('orphans children of a quarantined bean by clearing their parent field', ...)
Mock: CLI returns [childBean] where childBean.parent = 'bad-parent-id'; normalizeBean on bad-parent bean throws; quarantine succeeds
Assert: UPDATE_BEAN_MUTATION called with { id: childBean.id, input: { parent: '' } } (no CREATE_BEAN_MUTATION)
Assert: returned beans contain child with parent cleared
Assert: showWarningMessage called mentioning the child code and quarantined file
Keep all other existing tests untouched (quarantine, repair, git history, etc.) 7. Investigate runtime tree hierarchy issue (open concern from last session)

Check ActiveBeansProvider.augmentBeans and DraftBeansProvider.augmentBeans
Confirm BeansTreeDataProvider.buildTree is receiving parent links — this is observational/diagnostic only; changes only if a concrete bug is found 8. Compile and run full test suite

pnpm run compile
pnpm run test
Fix any type errors or broken test assertions introduced by the refactor 9. Commit changes and close/update bean

Stage and commit with message refactor(service): replace placeholder creation with orphan-children on quarantine
Add any secondary commit for the deleteBean children check
Update bean body with Summary of Changes, set status completed
