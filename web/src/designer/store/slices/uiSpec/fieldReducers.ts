import {PayloadAction} from '@reduxjs/toolkit';
import {v4 as uuidv4} from 'uuid';
import {ConditionType} from '../../../components/condition/types';
import {getFieldSpec} from '../../../fields';
import {FieldType, NotebookUISpec} from '../../../state/initial';
import {
  getViewSetForView,
  removeFieldFromSummary,
  removeFieldFromSummaryForViewset,
  replaceFieldInCondition,
  slugify,
} from '../../../state/helpers/uiSpec-helpers';

export const fieldReducers = {
  fieldUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{fieldName: string; newField: FieldType}>
  ) => {
    const {fieldName, newField} = action.payload;
    const fields = state.fields as {[key: string]: FieldType};
    if (fieldName in fields) {
      fields[fieldName] = newField;
    } else {
      throw new Error(
        `Cannot update unknown field ${fieldName} via fieldUpdated action`
      );
    }
  },
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
      throw new Error(`Cannot toggle protection for unknown field ${fieldName}`);
    }
  },
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
  fieldMoved: (
    state: NotebookUISpec,
    action: PayloadAction<{
      fieldName: string;
      viewId: string;
      direction: 'up' | 'down';
    }>
  ) => {
    const {fieldName, viewId, direction} = action.payload;
    const fieldList = state.fviews[viewId].fields;
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
    state.fviews[viewId].fields = fieldList;
  },
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

    const sourceFields = state.fviews[sourceViewId].fields;
    state.fviews[sourceViewId].fields = sourceFields.filter(
      field => field !== fieldName
    );

    state.fviews[targetViewId].fields.push(fieldName);

    const sourceViewSetId = getViewSetForView(state, sourceViewId);
    const targetViewSetId = getViewSetForView(state, targetViewId);
    if (sourceViewSetId && sourceViewSetId !== targetViewSetId) {
      removeFieldFromSummaryForViewset(state, fieldName, sourceViewSetId);
    }
  },
  fieldRenamed: (
    state: NotebookUISpec,
    action: PayloadAction<{
      viewId: string;
      fieldName: string;
      newFieldName: string;
    }>
  ) => {
    const {viewId, fieldName, newFieldName} = action.payload;
    if (!(fieldName in state.fields)) {
      throw new Error(
        `Cannot rename unknown field ${fieldName} via fieldRenamed action`
      );
    }

    const field = state.fields[fieldName];

    let fieldLabel = slugify(newFieldName);
    let N = 1;
    while (fieldLabel in state.fields) {
      fieldLabel = slugify(newFieldName + ' ' + N);
      N += 1;
    }

    field['component-parameters'].name = fieldLabel;
    state.fields[fieldLabel] = field;
    delete state.fields[fieldName];

    const viewFields = state.fviews[viewId].fields;
    for (let i = 0; i < viewFields.length; i++) {
      if (viewFields[i] === fieldName) {
        viewFields[i] = fieldLabel;
        break;
      }
    }

    Object.values(state.fields).forEach(f => {
      if (f.condition) {
        f.condition = replaceFieldInCondition(
          f.condition,
          fieldName,
          fieldLabel
        );
      }
    });

    Object.values(state.fviews).forEach(v => {
      if (v.condition) {
        const newCondition = replaceFieldInCondition(
          v.condition,
          fieldName,
          fieldLabel
        );
        if (newCondition === null) {
          delete v.condition;
        } else {
          v.condition = newCondition;
        }
      }
    });

    Object.values(state.viewsets).forEach(vs => {
      if (vs.summary_fields) {
        vs.summary_fields = vs.summary_fields.map(f =>
          f === fieldName ? fieldLabel : f
        );
      }
      if (vs.hridField === fieldName) {
        vs.hridField = fieldLabel;
      }
    });
  },
  fieldAdded: (
    state: NotebookUISpec,
    action: PayloadAction<{
      fieldName: string;
      fieldType: string;
      viewId: string;
      viewSetId: string;
      addAfter: string;
    }>
  ) => {
    const {fieldName, fieldType, viewId, viewSetId, addAfter} = action.payload;

    const newField: FieldType = getFieldSpec(fieldType);
    newField.designerIdentifier = uuidv4();

    let fieldLabel = slugify(fieldName);

    if (fieldType === 'RelatedRecordSelector') {
      newField['component-parameters'].related_type = viewSetId;
      newField['component-parameters'].related_type_label =
        state.viewsets[viewSetId].label;
    }

    if (fieldType === 'BasicAutoIncrementer') {
      newField['component-parameters'].form_id = viewId;
    }

    if (fieldType === 'TemplatedStringField') {
      let hasHRID = false;
      for (const sectionFieldName of state.fviews[viewId].fields) {
        if (
          sectionFieldName.startsWith('hrid') &&
          sectionFieldName.endsWith(viewId)
        ) {
          hasHRID = true;
          break;
        }
      }
      if (!hasHRID) {
        fieldLabel = 'hrid' + viewId;
      }
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

    let N = 1;
    while (fieldLabel in state.fields) {
      fieldLabel = slugify(fieldName + ' ' + N);
      N += 1;
    }
    newField['component-parameters'].name = fieldLabel;
    state.fields[fieldLabel] = newField;

    if (
      addAfter === '' ||
      state.fviews[viewId].fields.indexOf(addAfter) < 0
    ) {
      state.fviews[viewId].fields.push(fieldLabel);
    } else {
      const fields = state.fviews[viewId].fields;
      const position = fields.indexOf(addAfter) + 1;
      state.fviews[viewId].fields = fields
        .slice(0, position)
        .concat([fieldLabel])
        .concat(fields.slice(position));
    }
  },
  fieldDeleted: (
    state: NotebookUISpec,
    action: PayloadAction<{fieldName: string; viewId: string}>
  ) => {
    const {fieldName, viewId} = action.payload;
    if (fieldName in state.fields) {
      const protection =
        state.fields[fieldName]['component-parameters'].protection;
      if (protection === 'protected') {
        throw new Error(`Field ${fieldName} is protected and cannot be deleted.`);
      }
      delete state.fields[fieldName];
      state.fviews[viewId].fields = state.fviews[viewId].fields.filter(
        field => field !== fieldName
      );
      removeFieldFromSummary(state, fieldName);
    } else {
      throw new Error(
        `Cannot delete unknown field ${fieldName} via fieldDeleted action`
      );
    }
  },
  fieldDuplicated: (
    state: NotebookUISpec,
    action: PayloadAction<{
      originalFieldName: string;
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
    const newField: FieldType = JSON.parse(JSON.stringify(originalField));
    newField.designerIdentifier = uuidv4();

    let fieldLabel = slugify(newFieldName);
    let N = 1;
    while (fieldLabel in state.fields) {
      fieldLabel = slugify(newFieldName + ' ' + N);
      N += 1;
    }

    newField['component-parameters'].label = newFieldName;
    newField['component-parameters'].name = fieldLabel;

    state.fields[fieldLabel] = newField;

    const position = state.fviews[viewId].fields.indexOf(originalFieldName) + 1;
    state.fviews[viewId].fields.splice(position, 0, fieldLabel);
  },
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
