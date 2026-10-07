// SPDX-License-Identifier: Apache-2.0

import {PayloadAction} from '@reduxjs/toolkit';
import {ConditionType} from '../../../types/condition';
import {getFieldSpec} from '../../../fields';
import {FieldType, NotebookUISpec} from '../../../state/initial';
import {
  getViewSetForView,
  removeFieldFromSummary,
  removeFieldFromSummaryForViewset,
} from '../../../state/helpers/uiSpec-helpers';
import {
  buildUniqueExportName,
  mintFieldStorageId,
  slugify,
} from '../../../domain/notebook/ids';
import {cloneField} from '../../../domain/notebook/fieldFactory';

/** Field-level RTK reducers merged into `uiSpecificationReducer`. */
export const fieldReducers = {
  /** Replace an existing field spec; ignores stale updates when field was renamed/deleted. */
  fieldUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{fieldName: string; newField: FieldType}>
  ) => {
    const {fieldName, newField} = action.payload;
    const fields = state.fields as {[key: string]: FieldType};
    if (fieldName in fields) {
      fields[fieldName] = newField;
    } else {
      // Can happen during quick typing + debounced updates after a field rename.
      // Ignore stale action to keep the editor responsive and non-fatal.
      return;
    }
  },
  /** Set `component-parameters.protection`; un-hides field when switching to `protected`. */
  toggleFieldProtection: (
    state: NotebookUISpec,
    action: PayloadAction<{
      fieldName: string;
      protection: 'protected' | 'allow-hiding' | 'none';
    }>
  ) => {
    const {fieldName, protection} = action.payload;
    if (fieldName in state.fields) {
      state.fields[fieldName]['component-parameters'].protection = protection;
      if (
        protection === 'protected' &&
        state.fields[fieldName]['component-parameters'].hidden
      ) {
        state.fields[fieldName]['component-parameters'].hidden = false;
      }
    } else {
      throw new Error(
        `Cannot toggle protection for unknown field ${fieldName}`
      );
    }
  },
  /** Toggle `component-parameters.hidden` (blocked for unknown field ids). */
  toggleFieldHidden: (
    state: NotebookUISpec,
    action: PayloadAction<{fieldName: string; hidden: boolean}>
  ) => {
    const {fieldName, hidden} = action.payload;
    if (fieldName in state.fields) {
      state.fields[fieldName]['component-parameters'].hidden = hidden;
    } else {
      throw new Error(`Cannot toggle hidden for unknown field ${fieldName}`);
    }
  },
  /** Swap field order within one section (`viewId`) by one step up/down. */
  fieldMoved: (
    state: NotebookUISpec,
    action: PayloadAction<{
      fieldName: string;
      viewId: string;
      direction: 'up' | 'down';
    }>
  ) => {
    const {fieldName, viewId, direction} = action.payload;
    const fieldList = state.views[viewId].fields;
    for (let i = 0; i < fieldList.length; i++) {
      if (fieldList[i] === fieldName) {
        if (direction === 'up') {
          if (i > 0) {
            const tmp = fieldList[i - 1];
            fieldList[i - 1] = fieldList[i];
            fieldList[i] = tmp;
          }
        } else {
          if (i < fieldList.length - 1) {
            const tmp = fieldList[i + 1];
            fieldList[i + 1] = fieldList[i];
            fieldList[i] = tmp;
          }
        }
        break;
      }
    }
    state.views[viewId].fields = fieldList;
  },
  /** Move a field directly to an index position in a section (`viewId`). */
  fieldReordered: (
    state: NotebookUISpec,
    action: PayloadAction<{
      viewId: string;
      sourceIndex: number;
      targetIndex: number;
    }>
  ) => {
    const {viewId, sourceIndex, targetIndex} = action.payload;
    const fieldList = state.views[viewId].fields;

    if (
      sourceIndex < 0 ||
      targetIndex < 0 ||
      sourceIndex >= fieldList.length ||
      targetIndex >= fieldList.length ||
      sourceIndex === targetIndex
    ) {
      return;
    }

    const [movedField] = fieldList.splice(sourceIndex, 1);
    fieldList.splice(targetIndex, 0, movedField);
    state.views[viewId].fields = fieldList;
  },
  /** Remove field from `sourceViewId` and append to `targetViewId`; cleans cross-form summary fields. */
  fieldMovedToSection: (
    state: NotebookUISpec,
    action: PayloadAction<{
      fieldName: string;
      sourceViewId: string;
      targetViewId: string;
    }>
  ) => {
    const {fieldName, sourceViewId, targetViewId} = action.payload;

    if (!(fieldName in state.fields)) {
      throw new Error(`Cannot move unknown field ${fieldName}`);
    }

    const sourceFields = state.views[sourceViewId].fields;
    state.views[sourceViewId].fields = sourceFields.filter(
      field => field !== fieldName
    );

    state.views[targetViewId].fields.push(fieldName);

    const sourceViewSetId = getViewSetForView(state, sourceViewId);
    const targetViewSetId = getViewSetForView(state, targetViewId);
    if (sourceViewSetId && sourceViewSetId !== targetViewSetId) {
      removeFieldFromSummaryForViewset(state, fieldName, sourceViewSetId);
    }
  },
  /** Updates `exportName` only. The storage key never moves. */
  fieldRenamed: (
    state: NotebookUISpec,
    action: PayloadAction<{
      viewId: string;
      /** Immutable `uiSpec.fields` key. */
      fieldName: string;
      /** Desired export / column name (slugified for uniqueness). */
      newExportName: string;
    }>
  ) => {
    const {fieldName, newExportName} = action.payload;
    if (!(fieldName in state.fields)) {
      throw new Error(
        `Cannot rename unknown field ${fieldName} via fieldRenamed action`
      );
    }

    const field = state.fields[fieldName];
    // Punctuation-only names slugify to "" and fail z.string().min(1) on save.
    if (!slugify(newExportName)) {
      return;
    }

    const otherExportNames = Object.entries(state.fields)
      .filter(([id]) => id !== fieldName)
      .map(([, f]) => f.exportName);

    field.exportName = buildUniqueExportName(newExportName, otherExportNames);
  },
  /**
   * Clones default spec from `getFieldSpec`, mints a storage id and unique
   * `exportName`, and inserts after `addAfter` in the section.
   * Applies type-specific defaults (related record, autoincrement `form_id`).
   */
  fieldAdded: (
    state: NotebookUISpec,
    action: PayloadAction<{
      /** User-facing label; seeds `exportName`. Storage id is minted separately. */
      fieldName: string;
      fieldType: string;
      viewId: string;
      viewSetId: string;
      addAfter: string;
      /**
       * Optional pre-minted `uiSpec.fields` key so the add-field UI can expand
       * and focus the new accordion without a second random mint.
       */
      storageId?: string;
    }>
  ) => {
    const {fieldName, fieldType, viewId, viewSetId, addAfter} = action.payload;

    const newField: FieldType = getFieldSpec(fieldType);
    newField.designerIdentifier = crypto.randomUUID();

    if (fieldType === 'RelatedRecordSelector') {
      newField['component-parameters'].related_type = viewSetId;
      newField['component-parameters'].related_type_label =
        state.viewsets[viewSetId].label;
    }

    if (fieldType === 'BasicAutoIncrementer') {
      // Scope auto-increment to this section (form_id must match the view id).
      newField['component-parameters'].form_id = viewId;
    }

    newField.meta = {
      annotation: {
        include: false,
        label: 'annotation',
      },
      uncertainty: {
        include: false,
        label: 'uncertainty',
      },
    };
    newField['component-parameters'].label = fieldName;

    const requestedStorageId = action.payload.storageId;
    const storageId =
      requestedStorageId && !(requestedStorageId in state.fields)
        ? requestedStorageId
        : mintFieldStorageId(Object.keys(state.fields));
    const exportName = buildUniqueExportName(
      fieldName,
      Object.values(state.fields).map(f => f.exportName)
    );
    newField['component-parameters'].name = storageId;
    newField.exportName = exportName;
    state.fields[storageId] = newField;

    if (addAfter === '' || state.views[viewId].fields.indexOf(addAfter) < 0) {
      state.views[viewId].fields.push(storageId);
    } else {
      const fields = state.views[viewId].fields;
      const position = fields.indexOf(addAfter) + 1;
      state.views[viewId].fields = fields
        .slice(0, position)
        .concat([storageId])
        .concat(fields.slice(position));
    }
  },
  /** Removes field and strips from summaries; throws if field is `protected`. */
  fieldDeleted: (
    state: NotebookUISpec,
    action: PayloadAction<{fieldName: string; viewId: string}>
  ) => {
    const {fieldName, viewId} = action.payload;
    if (fieldName in state.fields) {
      const protection =
        state.fields[fieldName]['component-parameters'].protection;
      if (protection === 'protected') {
        throw new Error(
          `Field ${fieldName} is protected and cannot be deleted.`
        );
      }
      delete state.fields[fieldName];
      state.views[viewId].fields = state.views[viewId].fields.filter(
        field => field !== fieldName
      );
      removeFieldFromSummary(state, fieldName);
    } else {
      throw new Error(
        `Cannot delete unknown field ${fieldName} via fieldDeleted action`
      );
    }
  },
  /** Deep-clone field with new id/label inserted after the original in the same section. */
  fieldDuplicated: (
    state: NotebookUISpec,
    action: PayloadAction<{
      /** Storage id of the field being copied. */
      originalFieldName: string;
      /** User-facing label for the copy; seeds the new `exportName`. */
      newFieldName: string;
      viewId: string;
    }>
  ) => {
    const {originalFieldName, newFieldName, viewId} = action.payload;

    if (!(originalFieldName in state.fields)) {
      throw new Error(
        `Cannot duplicate unknown field ${originalFieldName} via fieldDuplicated action`
      );
    }

    const originalField = state.fields[originalFieldName];
    const newField = cloneField(originalField);
    newField.designerIdentifier = crypto.randomUUID();

    const storageId = mintFieldStorageId(Object.keys(state.fields));
    const exportName = buildUniqueExportName(
      newFieldName,
      Object.values(state.fields).map(f => f.exportName)
    );

    newField['component-parameters'].label = newFieldName;
    newField['component-parameters'].name = storageId;
    newField.exportName = exportName;

    state.fields[storageId] = newField;

    const position = state.views[viewId].fields.indexOf(originalFieldName) + 1;
    state.views[viewId].fields.splice(position, 0, storageId);
  },
  /** Set or clear `field.condition` for visibility rules. */
  fieldConditionChanged: (
    state: NotebookUISpec,
    action: PayloadAction<{
      fieldName: string;
      condition: ConditionType | null;
    }>
  ) => {
    const {fieldName, condition} = action.payload;
    const field = state.fields[fieldName];
    if (!field) throw new Error(`Unknown field ${fieldName}`);

    if (condition === null) delete field.condition;
    else field.condition = condition;
  },
};
