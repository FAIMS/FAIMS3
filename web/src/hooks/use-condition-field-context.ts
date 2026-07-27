import {
  FieldSearchScope,
  resolveFieldIdsInScope,
} from '@/designer/features/field-search';
import {useAppSelector} from '@/designer/state/hooks';
import {selectUiViews, selectUiViewSets} from '@/designer/store/selectors';
import {useMemo} from 'react';

/**
 * Gets the field search scope and selectable field state for a condition rule.
 *
 * @param props - Current field or section condition context.
 * @returns Field map, search scope, and selectable field count.
 */
export const useConditionRuleFieldContext = (props: {
  field?: string;
  view?: string;
}) => {
  const allFields = useAppSelector(
    state => state.notebook.uiSpec.present.fields
  );

  const views = useAppSelector(selectUiViews);
  const viewsets = useAppSelector(selectUiViewSets);

  // Work out which fields to show in the field selector. Conditions can only
  // reference fields within the same form, so scope the list to the current
  // form (viewset): resolve the entry context (props.field or props.view) to
  // its containing form, then gather every field across that form's sections
  // (mirrors TemplatedStringFieldEditor's viewSetFields). If the form can't be
  // resolved, show nothing rather than leaking other forms' fields. Then remove
  // either the current field or the fields in the current view.
  const fieldSearchScope = useMemo((): FieldSearchScope => {
    // Which section's condition are we editing?
    if (props.view) {
      return {kind: 'context', sectionId: props.view};
    }

    if (props.field) {
      return {kind: 'context', fieldId: props.field};
    }
    // Standalone use, no context: nothing to scope to, show all fields.
    return {kind: 'all'};
  }, [props.view, props.field]);

  const selectableFieldCount = useMemo(
    () =>
      resolveFieldIdsInScope(allFields, views, viewsets, fieldSearchScope)
        .length,
    [allFields, views, viewsets, fieldSearchScope]
  );

  return {
    allFields,
    fieldSearchScope,
    selectableFieldCount,
  };
};
