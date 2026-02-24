/**
 * Defines which bean types are valid parents for each child type.
 * Mirrors the CLI's internal ValidateParent rule: milestone → epic → feature → task/bug.
 *
 * Types absent from this map (e.g. `milestone`) have no restriction on parent type.
 */
export const VALID_PARENT_TYPES: Readonly<Record<string, readonly string[]>> = {
  epic: ['milestone'],
  feature: ['milestone', 'epic'],
  task: ['milestone', 'epic', 'feature'],
  bug: ['milestone', 'epic', 'feature'],
};
