import type { FieldSpec } from '../types';

/** Field components that do not produce a meaningful visual preview. */
const NO_PREVIEW_COMPONENTS = new Set([
  'TemplatedStringField',
  'BasicAutoIncrementer',
]);

/** Whether a field is worth rendering and capturing for the Word export. */
export function isFieldPreviewSupported(field: FieldSpec): boolean {
  if (field['component-parameters']?.hidden === true) return false;
  const componentName = field['component-name'];
  if (!componentName) return false;
  return !NO_PREVIEW_COMPONENTS.has(componentName);
}
