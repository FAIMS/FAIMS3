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

/**
 * @file Authoring dialog for a Map Collection plan template: name it, pick the
 * target form, the one spatial field each planned record's geometry fills, and
 * the other fields the list pre-fills, each required or optional.
 */

import {useEffect, useMemo, useState} from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  authoredSchema,
  isMapCollectionSpatialComponent,
  isMapCollectionSupportedFieldType,
  MAP_COLLECTION_PLAN_TYPE,
  mapCollectionPlanTemplateSchema,
  mapCollectionTemplateIssues,
  SPATIAL_FIELDS,
  type MapCollectionRecordField,
} from '@faims3/data-model';
import {PlanFields, usePlanFields} from './PlanFields';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogContentSx,
  designerDialogTitleSx,
} from '../designer-style';
import {SimpleFieldWrapper} from '../Fields/SimpleFieldWrapper';
import {FieldSearchAutocomplete} from '../field-selector';
import type {PlanDialogProps, PlanDialogUiSpec} from '../../plans';

// The same value every save, so it is built once rather than per save
const authoredMapCollectionTemplateSchema = authoredSchema(
  mapCollectionPlanTemplateSchema
);

/** What a spatial field stores, as a user would name it. */
export const spatialFieldKind = (
  field: PlanDialogUiSpec['fields'][string]
): string => {
  if (field?.['component-name'] === 'TakePoint') return 'GPS point';
  const featureType = field?.['component-parameters']?.featureType;
  switch (featureType) {
    case 'LineString':
      return 'Line';
    case 'Polygon':
      return 'Polygon';
    default:
      return 'Point';
  }
};

/** Pick the form, spatial field and pre-filled fields for a Map Collection plan. */
export const MapCollectionPlanDialog = ({
  open,
  uiSpec,
  initialTemplate,
  takenLabels,
  onClose,
  onSave,
}: PlanDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const viewSets = uiSpec.viewsets;

  const planFields = usePlanFields({open, initialTemplate, takenLabels});
  const [formType, setFormType] = useState('');
  const [spatialFieldId, setSpatialFieldId] = useState('');
  const [recordFields, setRecordFields] = useState<MapCollectionRecordField[]>(
    []
  );
  const [alertMessage, setAlertMessage] = useState('');

  // Fields belonging to the chosen form, across all its sections
  const formFields = useMemo(() => {
    if (!formType || !(formType in viewSets)) return [];
    return (viewSets[formType]?.views ?? []).flatMap(
      viewId => uiSpec.views[viewId]?.fields ?? []
    );
  }, [formType, uiSpec]);

  // The form's spatial fields: what the plan's geometry can be written to
  const spatialFields = useMemo(
    () =>
      formFields.filter(fieldName =>
        isMapCollectionSpatialComponent(
          uiSpec.fields[fieldName]?.['component-name']
        )
      ),
    [formFields, uiSpec]
  );

  // Fields the list cannot pre-fill with a simple value are not offered
  const unsupportedFields = useMemo(
    () =>
      formFields.filter(
        fieldName =>
          !isMapCollectionSupportedFieldType(
            uiSpec.fields[fieldName]?.['type-returned']
          )
      ),
    [formFields, uiSpec]
  );
  const offerableCount = formFields.length - unsupportedFields.length;

  // Re-derive local state each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const initial = initialTemplate?.formType as string | undefined;
    if (initial && initial in viewSets) {
      setFormType(initial);
      setSpatialFieldId((initialTemplate?.spatialFieldId as string) ?? '');
      setRecordFields(
        (initialTemplate?.recordFields as MapCollectionRecordField[]) ?? []
      );
      setAlertMessage('');
    } else {
      setFormType('');
      setSpatialFieldId('');
      setRecordFields([]);
      setAlertMessage(
        initial
          ? 'The previously selected form no longer exists. Choose another.'
          : ''
      );
    }
  }, [open, initialTemplate, viewSets]);

  const fieldLabel = (fieldName: string): string => {
    const authored = uiSpec.fields[fieldName]?.['component-parameters']?.label;
    return typeof authored === 'string' && authored ? authored : fieldName;
  };

  const addField = (fieldName: string) => {
    setRecordFields(current =>
      current.some(f => f.fieldId === fieldName)
        ? current
        : [...current, {fieldId: fieldName, required: false}]
    );
  };

  const removeField = (fieldName: string) => {
    setRecordFields(current => current.filter(f => f.fieldId !== fieldName));
  };

  const toggleRequired = (fieldName: string) => {
    setRecordFields(current =>
      current.map(f =>
        f.fieldId === fieldName ? {...f, required: !f.required} : f
      )
    );
  };

  const handleFormChange = (newFormType: string) => {
    setAlertMessage('');
    setFormType(newFormType);
    // Field choices belong to a form; changing form resets them
    setSpatialFieldId('');
    setRecordFields([]);
  };

  const handleSave = () => {
    const result = authoredMapCollectionTemplateSchema.safeParse({
      planType: MAP_COLLECTION_PLAN_TYPE,
      ...planFields.authored,
      formType,
      recordFields,
      spatialFieldId,
    });
    if (!result.success) {
      setAlertMessage(
        !formType
          ? 'Please choose a form for this plan.'
          : 'Please choose the spatial field for this plan.'
      );
      return;
    }
    const issues = mapCollectionTemplateIssues(result.data);
    if (issues.length > 0) {
      setAlertMessage(issues[0]);
      return;
    }
    onSave(result.data);
  };

  const spatialOnForm = spatialFields.includes(spatialFieldId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <DialogTitle sx={designerDialogTitleSx}>
        <Typography variant="h6" component="span" sx={{fontWeight: 800}}>
          Map Collection Plan
        </Typography>
      </DialogTitle>
      <DialogContent sx={{...designerDialogContentSx, pt: 4}}>
        <Box sx={{maxWidth: 740, width: '100%', mx: 'auto'}}>
          <PlanFields state={planFields} />

          <Box sx={{mt: 3}}>
            <SimpleFieldWrapper
              heading="Form"
              helperText={
                alertMessage ||
                'Records of this form are created from the planned list. The list itself is supplied as a spatial file when a notebook is created from this template.'
              }
            >
              <TextField
                select
                fullWidth
                value={formType}
                error={Boolean(alertMessage)}
                onChange={event => handleFormChange(event.target.value)}
                sx={{mt: 0.85}}
                data-testid="map-plan-form"
              >
                {Object.entries(viewSets).map(([id, viewSet]) =>
                  viewSet ? (
                    <MenuItem key={id} value={id}>
                      {viewSet.label}
                    </MenuItem>
                  ) : null
                )}
              </TextField>
            </SimpleFieldWrapper>
          </Box>

          {formType && (
            <Box sx={{mt: 3}}>
              <SimpleFieldWrapper
                heading="Spatial field"
                helperText="The map or GPS field each planned record's geometry is written to. Every planned record must carry geometry for it."
              >
                <Box sx={{mt: 0.85}}>
                  {spatialFields.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      This form has no map or GPS field. Add one to the form
                      first.
                    </Typography>
                  ) : (
                    <FieldSearchAutocomplete
                      value={spatialOnForm ? spatialFieldId : null}
                      onChange={fieldName => setSpatialFieldId(fieldName ?? '')}
                      scope={{kind: 'viewset', viewsetId: formType}}
                      filters={{componentNames: SPATIAL_FIELDS}}
                      limit={formFields.length}
                      label="Spatial field"
                      placeholder="Search map and GPS fields…"
                      size="small"
                      noOptionsText="No map or GPS fields on this form"
                      data-testid="map-plan-spatial-field"
                    />
                  )}
                  {spatialFieldId && !spatialOnForm && (
                    <Chip
                      sx={{mt: 1.5}}
                      label={fieldLabel(spatialFieldId)}
                      color="warning"
                      onDelete={() => setSpatialFieldId('')}
                      title="This field is no longer a map or GPS field on the form"
                    />
                  )}
                  {spatialOnForm && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{display: 'block', mt: 1}}
                    >
                      Stores a {spatialFieldKind(uiSpec.fields[spatialFieldId])}
                      .
                    </Typography>
                  )}
                </Box>
              </SimpleFieldWrapper>
            </Box>
          )}

          {formType && (
            <Box sx={{mt: 3}}>
              <SimpleFieldWrapper
                heading="Pre-filled fields"
                helperText="Fields of the form each planned record supplies values for, read from the spatial file's attributes. Text, number and yes/no fields can be pre-filled. A required field must be supplied for every planned record."
              >
                <Box sx={{mt: 0.85}}>
                  {offerableCount === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {formFields.length === 0
                        ? 'This form has no fields yet.'
                        : 'This form has no fields the list can pre-fill.'}
                    </Typography>
                  ) : (
                    <FieldSearchAutocomplete
                      value={null}
                      onChange={fieldName => {
                        if (fieldName) addField(fieldName);
                      }}
                      scope={{kind: 'viewset', viewsetId: formType}}
                      filters={{
                        excludeFieldIds: [
                          ...recordFields.map(f => f.fieldId),
                          ...unsupportedFields,
                          ...spatialFields,
                        ],
                      }}
                      // Every field of the form stays reachable by browsing, not only the first page
                      limit={formFields.length}
                      label="Add field"
                      placeholder="Search fields…"
                      size="small"
                      clearOnSelect
                      noOptionsText="No fields left to add"
                      data-testid="map-plan-field-add"
                    />
                  )}
                  <Stack spacing={1} sx={{mt: 1.5}}>
                    {recordFields.map(({fieldId, required}) => {
                      // A field can be deleted from the form after the plan chose it
                      const onForm = formFields.includes(fieldId);
                      const supported = !unsupportedFields.includes(fieldId);
                      const chip = (
                        <Chip
                          label={fieldLabel(fieldId)}
                          color={onForm && supported ? 'default' : 'warning'}
                          onDelete={() => removeField(fieldId)}
                        />
                      );
                      return (
                        <Box
                          key={fieldId}
                          sx={{display: 'flex', alignItems: 'center', gap: 1}}
                          data-testid={`map-plan-field-${fieldId}`}
                        >
                          {onForm && supported ? (
                            chip
                          ) : (
                            <Tooltip
                              title={
                                onForm
                                  ? "This field's type cannot be pre-filled by the list"
                                  : 'This field is no longer on the form'
                              }
                            >
                              <span>{chip}</span>
                            </Tooltip>
                          )}
                          <Button
                            size="small"
                            variant={required ? 'contained' : 'outlined'}
                            onClick={() => toggleRequired(fieldId)}
                            aria-pressed={required}
                            aria-label={`${fieldLabel(fieldId)} ${
                              required ? 'required' : 'optional'
                            }`}
                          >
                            {required ? 'Required' : 'Optional'}
                          </Button>
                        </Box>
                      );
                    })}
                    {recordFields.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No fields chosen yet.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </SimpleFieldWrapper>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={designerDialogActionsSx}>
        <Button onClick={onClose} sx={designerCancelButtonSx}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!formType || !spatialFieldId || !planFields.canSave}
          onClick={handleSave}
        >
          Save Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
};
