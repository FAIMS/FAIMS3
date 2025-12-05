/** Deterministic field name generator for usage for navigations */
export function getFieldId({fieldId}: {fieldId: string}): string {
  return `field-${fieldId}`;
}
