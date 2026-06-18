import type { UiSpecModel } from '@faims3/data-model';
import type { FieldSpec } from '../types';

export const PREVIEW_FORM_ID = '__field-preview-form__';
export const PREVIEW_SECTION_ID = '__field-preview-section__';

/** Build a minimal uiSpec containing only one field (no conditions). */
export function buildSingleFieldUiSpec(fieldName: string, field: FieldSpec): UiSpecModel {
  const { condition: _condition, ...fieldWithoutCondition } = field;
  return {
    fields: {
      [fieldName]: fieldWithoutCondition as UiSpecModel['fields'][string],
    },
    views: {
      [PREVIEW_SECTION_ID]: {
        fields: [fieldName],
      },
    },
    viewsets: {
      [PREVIEW_FORM_ID]: {
        views: [PREVIEW_SECTION_ID],
        layout: 'inline',
      },
    },
    visible_types: [PREVIEW_FORM_ID],
  };
}
