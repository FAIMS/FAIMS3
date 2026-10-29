// SPDX-License-Identifier: Apache-2.0
import {Edit as EditIcon} from '@mui/icons-material';
import {Box, Button, Grid, Typography} from '@mui/material';
import {MutableRefObject, useMemo, useRef, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {MustacheTemplateBuilder} from '../TemplateBuilder';
import DebouncedTextField from '../debounced-text-field';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {selectCustomMetadata} from '../../store/selectors';
import {getFieldLabel} from '@/lib/conditionUtils';
import {
  buildParentFieldTypes,
  buildRelatedFieldTypes,
  encodeMetadataRef,
  isReferenceableMetadataKey,
  PARENT_REFERENCE_PREFIX,
  UiSpecModel,
} from '@faims3/data-model';
import {BaseFieldEditor} from './BaseFieldEditor';

type PropType = {
  fieldName: string;
  viewId: string;
  viewsetId: string;
};

/**
 * Property editor for TemplatedStringField. Label, export name and helper text
 * come from {@link BaseFieldEditor}; this adds the Mustache template input and
 * visual builder.
 */
export const TemplatedStringFieldEditor = ({
  fieldName,
  viewsetId,
}: PropType) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const allFields = useAppSelector(
    state => state.notebook.uiSpec.present.fields
  );
  const custom = useAppSelector(selectCustomMetadata);
  const dispatch = useAppDispatch();
  const textAreaRef = useRef(null) as MutableRefObject<unknown>;

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const template =
    (field['component-parameters'].template as string | undefined) || '';

  const viewSet = useAppSelector(
    state => state.notebook.uiSpec.present.viewsets[viewsetId]
  );
  const views = useAppSelector(state => state.notebook.uiSpec.present.views);
  const viewsets = useAppSelector(
    state => state.notebook.uiSpec.present.viewsets
  );

  /**
   * Collects all fields that belong to any view in the current viewset
   */
  const viewSetFields = useMemo(() => {
    const fieldSet = new Set<string>();
    viewSet.views.forEach(viewId => {
      const view = views[viewId];
      if (view) {
        view.fields.forEach(fieldId => fieldSet.add(fieldId));
      }
    });
    return Array.from(fieldSet);
  }, [viewSet.views, views]);

  // Define system variables
  const systemVariables = [
    {
      name: '_CREATOR_NAME',
      displayName: 'Creator Name',
      type: 'system' as const,
    },
    {
      name: '_CREATED_TIME',
      displayName: 'Created Time',
      type: 'system' as const,
    },
  ];

  const fieldVariables = viewSetFields.map(name => ({
    name,
    displayName: getFieldLabel(allFields[name]) || name,
    type: 'field' as const,
  }));

  // Parent fields usable as {{_PARENT.Field-ID}}.
  const parentVariables = useMemo(() => {
    const {types} = buildParentFieldTypes({
      uiSpecification: {
        fields: allFields,
        views,
        viewsets,
      } as unknown as UiSpecModel,
      formId: viewsetId,
    });
    return [...types.keys()].map(ref => {
      const id = ref.slice(PARENT_REFERENCE_PREFIX.length);
      return {
        name: ref,
        displayName: `Parent: ${getFieldLabel(allFields[id]) || id}`,
        type: 'field' as const,
      };
    });
  }, [allFields, views, viewsets, viewsetId]);

  // Notebook metadata usable as {{_METADATA.key}}.
  const metadataVariables = useMemo(
    () =>
      Object.keys(custom)
        .filter(isReferenceableMetadataKey)
        .map(key => ({
          name: encodeMetadataRef(key),
          displayName: `Notebook: ${key}`,
          type: 'field' as const,
        })),
    [custom]
  );

  // Fields on linked records usable as {{Rel-Field-ID.Field-ID}}.
  const relatedVariables = useMemo(() => {
    const {types} = buildRelatedFieldTypes({
      uiSpecification: {
        fields: allFields,
        views,
        viewsets,
      } as unknown as UiSpecModel,
      formId: viewsetId,
    });
    return [...types.keys()].map(ref => {
      const dot = ref.indexOf('.');
      const relFieldId = ref.slice(0, dot);
      const id = ref.slice(dot + 1);
      const relLabel = getFieldLabel(allFields[relFieldId]) || relFieldId;
      const label = getFieldLabel(allFields[id]) || id;
      return {
        name: ref,
        displayName: `${relLabel} > ${label}`,
        type: 'field' as const,
      };
    });
  }, [allFields, views, viewsets, viewsetId]);

  const updateTemplate = (value: string) => {
    const newField = withUpdatedField(field, nextField => {
      nextField['component-parameters'].template = value;
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  return (
    <BaseFieldEditor fieldName={fieldName} showExtraConfig={false}>
      <Box>
        <Typography variant="subtitle2" sx={{mb: 2}}>
          Template
        </Typography>

        <Grid container spacing={2}>
          <Grid size="grow">
            <DebouncedTextField
              name="template"
              inputRef={textAreaRef}
              variant="outlined"
              fullWidth
              multiline
              rows={4}
              value={template}
              onChange={e => updateTemplate(e.target.value)}
              helperText="Enter the template or use the visual builder"
            />
          </Grid>
          <Grid size="auto">
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setIsBuilderOpen(true)}
              sx={{height: '56px'}}
            >
              Visual Builder
            </Button>
          </Grid>
        </Grid>
      </Box>

      <MustacheTemplateBuilder
        open={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        initialTemplate={template}
        variables={[
          ...fieldVariables,
          ...parentVariables,
          ...relatedVariables,
          ...metadataVariables,
        ]}
        systemVariables={systemVariables}
        onSave={updateTemplate}
      />
    </BaseFieldEditor>
  );
};
