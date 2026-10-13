/**
 * The form field components whose values hold record geometry. A leaf module,
 * so the plans and uiSpecification modules can both read it without importing
 * each other.
 */
export const SPATIAL_FIELDS = ['MapFormField', 'TakePoint'];

/** Whether a field component (by `component-name`) stores geometry. */
export const isSpatialFieldComponent = (componentName?: string): boolean =>
  SPATIAL_FIELDS.includes(componentName ?? '');
