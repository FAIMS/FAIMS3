// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {PayloadAction, createSlice} from '@reduxjs/toolkit';
import {NotebookUISpec, FieldType, initialState} from './initial';
import {getFieldSpec} from '../fields';
import {ConditionType} from '../components/condition/types';
import {
  slugify,
  getViewSetForView,
  removeFieldFromSummary,
  removeFieldFromSummaryForViewset,
  replaceFieldInCondition,
} from './helpers/uiSpec-helpers';
import {v4 as uuidv4} from 'uuid';

const uiSpecInitialState: NotebookUISpec =
  initialState.notebook['ui-specification'].present;

export const uiSpecificationReducer = createSlice({
  name: 'ui-specification',
  initialState: uiSpecInitialState,
  reducers: {
    loaded: (_state, action: PayloadAction<NotebookUISpec>) => {
      _state = action.payload;
      return action.payload;
    },
    fieldUpdated: (
      state,
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
      state,
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
    toggleFieldHidden: (
      state,
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
      state,
      action: PayloadAction<{
        fieldName: string;
        viewId: string;
        direction: 'up' | 'down';
      }>
    ) => {
      const {fieldName, viewId, direction} = action.payload;
      // this involves finding the field in the list of fields in the view
      // and moving it up or down one
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
          // we're done
          break;
        }
      }
      state.fviews[viewId].fields = fieldList;
    },
    fieldMovedToSection: (
      state,
      action: PayloadAction<{
        fieldName: string;
        sourceViewId: string;
        targetViewId: string;
      }>
    ) => {
      const {fieldName, sourceViewId, targetViewId} = action.payload;

      // verify the field exists in source section
      if (!(fieldName in state.fields)) {
        throw new Error(`Cannot move unknown field ${fieldName}`);
      }

      // remove field from source section
      const sourceFields = state.fviews[sourceViewId].fields;
      state.fviews[sourceViewId].fields = sourceFields.filter(
        field => field !== fieldName
      );

      // add field to target section
      state.fviews[targetViewId].fields.push(fieldName);

      // Get viewset (form) ids for both fields.
      const sourceViewSetId = getViewSetForView(state, sourceViewId);
      const targetViewSetId = getViewSetForView(state, targetViewId);
      // If the field has moved to a different form or we couldn't find one of the forms,
      // then remove the field from the form's summary fields.
      if (sourceViewSetId && sourceViewSetId !== targetViewSetId) {
        removeFieldFromSummaryForViewset(state, fieldName, sourceViewSetId);
      }
    },
    fieldRenamed: (
      state,
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

      // ensure newFieldName is unique
      let fieldLabel = slugify(newFieldName);
      let N = 1;
      while (fieldLabel in state.fields) {
        fieldLabel = slugify(newFieldName + ' ' + N);
        N += 1;
      }

      field['component-parameters'].name = fieldLabel;
      state.fields[fieldLabel] = field;
      delete state.fields[fieldName];
      // replace reference in the view
      const viewFields = state.fviews[viewId].fields;
      for (let i = 0; i < viewFields.length; i++) {
        if (viewFields[i] === fieldName) {
          viewFields[i] = fieldLabel;
          break;
        }
      }

      /* Update every condition (fields AND sections) that mentions the old ID. */
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

      /* Update summary_fields and hridField in each form. */
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
      state,
      action: PayloadAction<{
        fieldName: string;
        fieldType: string;
        viewId: string;
        viewSetId: string;
        addAfter: string;
      }>
    ) => {
      const {fieldName, fieldType, viewId, viewSetId, addAfter} =
        action.payload;

      const newField: FieldType = getFieldSpec(fieldType);

      newField.designerIdentifier = uuidv4();

      let fieldLabel = slugify(fieldName);

      // some field types need to be modified with extra info
      if (fieldType === 'RelatedRecordSelector') {
        // need to set the related type to the form id
        newField['component-parameters'].related_type = viewSetId;
        newField['component-parameters'].related_type_label =
          state.viewsets[viewSetId].label;
      }

      if (fieldType === 'BasicAutoIncrementer') {
        newField['component-parameters'].form_id = viewId;
      }

      if (fieldType === 'TemplatedStringField') {
        // if there is no existing HRID field in this form, then
        // this field becomes one by getting a name starting 'hrid'
        let hasHRID = false;
        for (const fieldName of state.fviews[viewId].fields) {
          if (fieldName.startsWith('hrid') && fieldName.endsWith(viewId)) {
            hasHRID = true;
            break;
          }
        }
        if (!hasHRID) {
          fieldLabel = 'hrid' + viewId;
        }
      }

      // add in the meta field
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
      // set the field label
      newField['component-parameters'].label = fieldName;

      // ensure a unique field name
      let N = 1;
      while (fieldLabel in state.fields) {
        fieldLabel = slugify(fieldName + ' ' + N);
        N += 1;
      }
      newField['component-parameters'].name = fieldLabel;
      // add to fields and to the fview section
      state.fields[fieldLabel] = newField;

      // add either at the end or after a given field
      // as long as that field is present
      if (
        addAfter === '' ||
        state.fviews[viewId].fields.indexOf(addAfter) < 0
      ) {
        state.fviews[viewId].fields.push(fieldLabel);
      } else {
        const fields = state.fviews[viewId].fields;
        const position = fields.indexOf(addAfter) + 1;
        // insert after 'addAfter'
        state.fviews[viewId].fields = fields
          .slice(0, position)
          .concat([fieldLabel])
          .concat(fields.slice(position));
      }
    },
    fieldDeleted: (
      state,
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
      state,
      action: PayloadAction<{
        originalFieldName: string;
        newFieldName: string;
        viewId: string;
      }>
    ) => {
      const {originalFieldName, newFieldName, viewId} = action.payload;

      // check if original field exists
      if (!(originalFieldName in state.fields)) {
        throw new Error(
          `Cannot duplicate unknown field ${originalFieldName} via fieldDuplicated action`
        );
      }

      // create a deep copy of the original field
      const originalField = state.fields[originalFieldName];
      const newField: FieldType = JSON.parse(JSON.stringify(originalField));
      newField.designerIdentifier = uuidv4();

      // generate a unique field label/name
      let fieldLabel = slugify(newFieldName);
      let N = 1;
      while (fieldLabel in state.fields) {
        fieldLabel = slugify(newFieldName + ' ' + N);
        N += 1;
      }

      // update the new field's label and name
      newField['component-parameters'].label = newFieldName;
      newField['component-parameters'].name = fieldLabel;

      // add the new field to the state
      state.fields[fieldLabel] = newField;

      // add the new field to the view right after the original field
      const position =
        state.fviews[viewId].fields.indexOf(originalFieldName) + 1;
      state.fviews[viewId].fields.splice(position, 0, fieldLabel);
    },
    fieldConditionChanged: (
      state,
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
    sectionRenamed: (
      state,
      action: PayloadAction<{viewId: string; label: string}>
    ) => {
      const {viewId, label} = action.payload;
      if (viewId in state.fviews) {
        state.fviews[viewId].label = label;
      } else {
        throw new Error(
          `Can't update unknown section ${viewId} via sectionRenamed action`
        );
      }
    },
    sectionAdded: (
      state,
      action: PayloadAction<{viewSetId: string; sectionLabel: string}>
    ) => {
      const {viewSetId, sectionLabel} = action.payload;
      const sectionId = viewSetId + '-' + slugify(sectionLabel);
      const newSection = {
        label: sectionLabel,
        fields: [],
      };
      if (sectionId in state.fviews) {
        throw new Error(`Section ${sectionLabel} already exists in this form.`);
      } else {
        state.fviews[sectionId] = newSection;
        state.viewsets[viewSetId].views.push(sectionId);
      }
    },
    sectionDuplicated: (
      state,
      action: PayloadAction<{
        sourceViewId: string;
        destinationViewSetId?: string;
        newSectionLabel: string;
      }>
    ) => {
      const {sourceViewId, destinationViewSetId, newSectionLabel} =
        action.payload;

      if (!(sourceViewId in state.fviews)) {
        throw new Error(`Source section ${sourceViewId} does not exist.`);
      }

      // Find the destination form.
      let destViewSetId = destinationViewSetId;
      if (!destViewSetId) {
        for (const formId in state.viewsets) {
          if (state.viewsets[formId].views.includes(sourceViewId)) {
            destViewSetId = formId;
            break;
          }
        }
        if (!destViewSetId) {
          throw new Error(
            `Cannot determine the source form for section ${sourceViewId}.`
          );
        }
      }

      const newSectionId = destViewSetId + '-' + slugify(newSectionLabel);
      if (newSectionId in state.fviews) {
        throw new Error(
          `Section ${newSectionLabel} already exists in form ${destViewSetId}.`
        );
      }

      const sourceSection = state.fviews[sourceViewId];

      // Create the new section, copying any condition that exists.
      const newSection = {
        label: newSectionLabel,
        fields: [] as string[],
        condition: sourceSection.condition,
      };

      // Duplicate each field to the new section.
      for (const originalFieldName of sourceSection.fields) {
        if (!(originalFieldName in state.fields)) continue;
        const originalField = state.fields[originalFieldName];
        const baseLabel =
          originalField['component-parameters'].label || originalFieldName;
        const newFieldLabel = baseLabel;
        let fieldSlug = slugify(newFieldLabel);
        let N = 1;
        while (fieldSlug in state.fields) {
          fieldSlug = slugify(newFieldLabel + ' ' + N);
          N++;
        }
        // Deep copy
        const newField: FieldType = JSON.parse(JSON.stringify(originalField));
        newField['component-parameters'].label = newFieldLabel;
        newField['component-parameters'].name = fieldSlug;
        newField.designerIdentifier = uuidv4();

        // Add the new field to the state and record it in the new section.
        state.fields[fieldSlug] = newField;
        newSection.fields.push(fieldSlug);
      }

      // Add the new section to the fviews and to the destination form's views list.
      state.fviews[newSectionId] = newSection;
      state.viewsets[destViewSetId].views.push(newSectionId);
    },
    sectionDeleted: (
      state,
      action: PayloadAction<{viewSetID: string; viewID: string}>
    ) => {
      const {viewSetID, viewID} = action.payload;

      if (viewID in state.fviews) {
        // working copy of the field names ('fields') part of the section that is to be removed
        const sectionFields: string[] = state.fviews[viewID].fields;
        sectionFields.forEach(field => {
          if (field in state.fields) {
            // remove the fields in 'fields' belonging to the section
            delete state.fields[field];
          }
        });
        // remove the section from 'fviews' & 'viewsets'
        delete state.fviews[viewID];
        const newViewSetViews = state.viewsets[viewSetID].views.filter(
          view => view !== viewID
        );
        state.viewsets[viewSetID].views = newViewSetViews;
      }
    },
    sectionMovedToForm: (
      state,
      action: PayloadAction<{
        sourceViewSetId: string;
        targetViewSetId: string;
        viewId: string;
      }>
    ) => {
      const {sourceViewSetId, targetViewSetId, viewId} = action.payload;
      // remove the section from the source form
      const sourceViews = state.viewsets[sourceViewSetId].views;
      const newSourceViews = sourceViews.filter(view => view !== viewId);
      state.viewsets[sourceViewSetId].views = newSourceViews;
      // add the section to the target form
      state.viewsets[targetViewSetId].views.push(viewId);
    },
    sectionMoved: (
      state,
      action: PayloadAction<{
        viewSetId: string;
        viewId: string;
        direction: 'left' | 'right';
      }>
    ) => {
      const {viewSetId, viewId, direction} = action.payload;
      // this involves finding the section in the list of views in the viewset
      // and moving it left or right one
      const viewList = state.viewsets[viewSetId].views;
      for (let i = 0; i < viewList.length; i++) {
        if (viewList[i] === viewId) {
          if (direction === 'left') {
            if (i > 0) {
              const tmp = viewList[i - 1];
              viewList[i - 1] = viewList[i];
              viewList[i] = tmp;
            }
          } else {
            if (i < viewList.length - 1) {
              const tmp = viewList[i + 1];
              viewList[i + 1] = viewList[i];
              viewList[i] = tmp;
            }
          }
          // we're done
          break;
        }
      }
      state.viewsets[viewSetId].views = viewList;
    },
    sectionConditionChanged: (
      state,
      action: PayloadAction<{viewId: string; condition: ConditionType}>
    ) => {
      const {viewId, condition} = action.payload;

      if (viewId in state.fviews) {
        if (condition === null) {
          delete state.fviews[viewId].condition;
        } else {
          state.fviews[viewId].condition = condition;
        }
      }
    },
    viewSetAdded: (state, action: PayloadAction<{formName: string}>) => {
      const {formName} = action.payload;
      const newViewSet = {
        label: formName,
        views: [],
        publishButtonBehaviour: 'always' as 'always' | 'visited' | 'noErrors',
      };
      const formID = slugify(formName);
      // add this to the viewsets
      if (formID in state.viewsets) {
        throw new Error(`Form ${formID} already exists in notebook.`);
      } else {
        state.viewsets[formID] = newViewSet;
        state.visible_types.push(formID);
      }
    },

    viewSetDeleted: (state, action: PayloadAction<{viewSetId: string}>) => {
      const {viewSetId} = action.payload;

      if (viewSetId in state.viewsets) {
        // working copy of the section names ('views') part of the form that is to be removed
        const viewSetViews: string[] = state.viewsets[viewSetId].views;
        viewSetViews.forEach(view => {
          if (view in state.fviews) {
            // working copy of the field names ('fields') part of the section that is part of the form that is to be removed
            const viewFields: string[] = state.fviews[view].fields;
            viewFields.forEach(formField => {
              if (formField in state.fields) {
                // remove the fields in 'fields' belonging to their respective sections in the form
                delete state.fields[formField];
              }
            });
            // remove the sections in 'fviews' belonging to the form
            delete state.fviews[view];
          }
        });
        // remove the form from 'viewsets' and 'visible_types'
        delete state.viewsets[viewSetId];
        const newVisibleTypes = state.visible_types.filter(
          field => field !== viewSetId
        );
        state.visible_types = newVisibleTypes;
      }
    },
    viewSetMoved: (
      state,
      action: PayloadAction<{viewSetId: string; direction: 'left' | 'right'}>
    ) => {
      const {viewSetId, direction} = action.payload;

      const formsList = state.visible_types;
      // re-order the array
      for (let i = 0; i < formsList.length; i++) {
        if (formsList[i] === viewSetId) {
          if (direction === 'left') {
            if (i > 0) {
              const tmp = formsList[i - 1];
              formsList[i - 1] = formsList[i];
              formsList[i] = tmp;
            }
          } else {
            if (i < formsList.length - 1) {
              const tmp = formsList[i + 1];
              formsList[i + 1] = formsList[i];
              formsList[i] = tmp;
            }
          }
          // we're done
          break;
        }
      }
      // update state
      state.visible_types = formsList;
    },
    viewSetRenamed: (
      state,
      action: PayloadAction<{viewSetId: string; label: string}>
    ) => {
      const {viewSetId, label} = action.payload;
      if (viewSetId in state.viewsets) {
        state.viewsets[viewSetId].label = label;
      }
    },
    viewSetSummaryFieldsUpdated: (
      state,
      action: PayloadAction<{viewSetId: string; fields: string[]}>
    ) => {
      const {viewSetId, fields} = action.payload;
      if (viewSetId in state.viewsets) {
        // Update the viewset with the proposed summary fields
        state.viewsets[viewSetId].summary_fields = fields;
      }
    },
    viewSetLayoutUpdated: (
      state,
      action: PayloadAction<{viewSetId: string; layout?: 'inline' | 'tabs'}>
    ) => {
      const {viewSetId, layout} = action.payload;
      if (viewSetId in state.viewsets) {
        // Update the viewset with the proposed summary fields
        state.viewsets[viewSetId].layout = layout;
      }
    },
    viewSetHridUpdated: (
      state,
      action: PayloadAction<{viewSetId: string; hridField?: string}>
    ) => {
      const {viewSetId, hridField} = action.payload;
      if (viewSetId in state.viewsets) {
        state.viewsets[viewSetId].hridField = hridField;
      }
    },
    formVisibilityUpdated: (
      state,
      action: PayloadAction<{
        viewSetId: string;
        ticked: boolean;
        initialIndex: number;
      }>
    ) => {
      const {viewSetId, ticked} = action.payload;

      if (!ticked) {
        const newVisibleTypes = state.visible_types.filter(
          visibleType => visibleType !== viewSetId
        );
        state.visible_types = newVisibleTypes;
      } else {
        // currently re-adding the form back at the end of the visible_types array because
        // I can't figure out how to store the initial index correctly (keeps being -1, which obviously won't work)
        state.visible_types.splice(state.visible_types.length, 0, viewSetId);
      }
    },

    viewSetPublishButtonBehaviourUpdated: (
      state,
      action: PayloadAction<{
        viewSetId: string;
        publishButtonBehaviour: 'always' | 'visited' | 'noErrors';
      }>
    ) => {
      const {viewSetId, publishButtonBehaviour} = action.payload;
      if (viewSetId in state.viewsets) {
        state.viewsets[viewSetId].publishButtonBehaviour =
          publishButtonBehaviour;
      }
    },
  },
});

export const {
  loaded,
  fieldUpdated,
  fieldMoved,
  fieldMovedToSection,
  fieldRenamed,
  fieldAdded,
  fieldDeleted,
  fieldDuplicated,
  fieldConditionChanged,
  toggleFieldProtection,
  toggleFieldHidden,
  sectionRenamed,
  sectionAdded,
  sectionDuplicated,
  sectionDeleted,
  sectionMovedToForm,
  sectionMoved,
  sectionConditionChanged,
  viewSetAdded,
  viewSetDeleted,
  viewSetMoved,
  viewSetRenamed,
  formVisibilityUpdated,
  viewSetPublishButtonBehaviourUpdated,
  viewSetLayoutUpdated,
  viewSetSummaryFieldsUpdated,
} = uiSpecificationReducer.actions;
