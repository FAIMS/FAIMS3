import {PayloadAction} from '@reduxjs/toolkit';
import {v4 as uuidv4} from 'uuid';
import {ConditionType} from '../../../components/condition/types';
import {FieldType, NotebookUISpec} from '../../../state/initial';
import {slugify} from '../../../state/helpers/uiSpec-helpers';

export const sectionReducers = {
  sectionRenamed: (
    state: NotebookUISpec,
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
    state: NotebookUISpec,
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
    state: NotebookUISpec,
    action: PayloadAction<{
      sourceViewId: string;
      destinationViewSetId?: string;
      newSectionLabel: string;
    }>
  ) => {
    const {sourceViewId, destinationViewSetId, newSectionLabel} = action.payload;

    if (!(sourceViewId in state.fviews)) {
      throw new Error(`Source section ${sourceViewId} does not exist.`);
    }

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

    const newSection = {
      label: newSectionLabel,
      fields: [] as string[],
      condition: sourceSection.condition,
    };

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
      const newField: FieldType = JSON.parse(JSON.stringify(originalField));
      newField['component-parameters'].label = newFieldLabel;
      newField['component-parameters'].name = fieldSlug;
      newField.designerIdentifier = uuidv4();

      state.fields[fieldSlug] = newField;
      newSection.fields.push(fieldSlug);
    }

    state.fviews[newSectionId] = newSection;
    state.viewsets[destViewSetId].views.push(newSectionId);
  },
  sectionDeleted: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetID: string; viewID: string}>
  ) => {
    const {viewSetID, viewID} = action.payload;

    if (viewID in state.fviews) {
      const sectionFields: string[] = state.fviews[viewID].fields;
      sectionFields.forEach(field => {
        if (field in state.fields) {
          delete state.fields[field];
        }
      });
      delete state.fviews[viewID];
      const newViewSetViews = state.viewsets[viewSetID].views.filter(
        view => view !== viewID
      );
      state.viewsets[viewSetID].views = newViewSetViews;
    }
  },
  sectionMovedToForm: (
    state: NotebookUISpec,
    action: PayloadAction<{
      sourceViewSetId: string;
      targetViewSetId: string;
      viewId: string;
    }>
  ) => {
    const {sourceViewSetId, targetViewSetId, viewId} = action.payload;
    const sourceViews = state.viewsets[sourceViewSetId].views;
    const newSourceViews = sourceViews.filter(view => view !== viewId);
    state.viewsets[sourceViewSetId].views = newSourceViews;
    state.viewsets[targetViewSetId].views.push(viewId);
  },
  sectionMoved: (
    state: NotebookUISpec,
    action: PayloadAction<{
      viewSetId: string;
      viewId: string;
      direction: 'left' | 'right';
    }>
  ) => {
    const {viewSetId, viewId, direction} = action.payload;
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
        break;
      }
    }
    state.viewsets[viewSetId].views = viewList;
  },
  sectionConditionChanged: (
    state: NotebookUISpec,
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
};
