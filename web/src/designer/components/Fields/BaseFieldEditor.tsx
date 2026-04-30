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

import {MDXEditorMethods} from '@mdxeditor/editor';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import MicIcon from '@mui/icons-material/Mic';
import SyncIcon from '@mui/icons-material/Sync';
import {
  Alert,
  Box,
  Card,
  Checkbox,
  Collapse,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {debounce} from 'lodash';
import {useCallback, useEffect, useRef, useState} from 'react';
import {VITE_TEMPLATE_PROTECTIONS} from '../../buildconfig';
import {getViewIDForField} from '../../state/helpers/uiSpec-helpers';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {
  fieldConditionChanged,
  fieldRenamed,
  fieldUpdated,
} from '../../store/slices/uiSpec';
import {ConditionType} from '../../types/condition';
import {ConditionModal} from '../condition/ConditionModal';
import {ConditionTranslation} from '../condition/ConditionTranslation';
import DebouncedTextField from '../debounced-text-field';
import {MdxEditor} from '../mdx-editor';
import {
  getSpeechSettings,
  updateSpeechSettings,
} from './SpeechSettingsEditor';
import {slugify} from '../../domain/notebook/ids';
import {designerCheckboxSx, designerInfoIconSx} from '../designer-style';

/** `component-namespace::component-name` keys eligible for speech settings in the inspector. */
export const SPEECH_ENABLED_FIELDS = [
  'faims-custom::FAIMSTextField',
  'formik-material-ui::MultipleTextField',
];

/** True if {@link SPEECH_ENABLED_FIELDS} includes this field's composite type key. */
const checkSpeechEnabled = (field: FieldType) => {
  return SPEECH_ENABLED_FIELDS.includes(
    `${field['component-namespace']}::${field['component-name']}`
  );
};

type Props = {
  fieldName: string;
  showExtraConfig?: boolean;
  showHelperText?: boolean;
  children?: React.ReactNode;
};

type StateType = {
  label?: string;
  helperText: string;
  advancedHelperText: string;
  required: boolean;
  persistent: boolean;
  displayParent: boolean;
  annotation: boolean;
  annotationLabel: string;
  uncertainty: boolean;
  uncertaintyLabel: string;
  condition?: ConditionType | null;
  protection: boolean;
  allowHiding: boolean;
};

/** sx applied to every Checkbox — green tick when checked, grey when unchecked. */
 /**
 * Default property sheet: label, persistence, meta flags, visibility condition, template protection.
 * Type-specific panels pass extra controls as `children`.
 */
export const BaseFieldEditor = ({
  fieldName,
  showExtraConfig = true,
  showHelperText = true,
  children,
}: Props) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const uiSpec = useAppSelector(
    state => state.notebook['ui-specification'].present
  );
  const dispatch = useAppDispatch();
  const mdxEditorRef = useRef<MDXEditorMethods>(null);

  const idInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(false);
  const [localFieldName, setLocalFieldName] = useState(fieldName);

  const debouncedRename = useCallback(
    debounce((newFieldName: string) => {
      const viewId = getViewIDForField(uiSpec, fieldName);
      if (viewId && newFieldName.trim() && newFieldName.trim() !== fieldName) {
        dispatch(
          fieldRenamed({
            viewId,
            fieldName,
            newFieldName: newFieldName.trim(),
          })
        );
      }
    }, 500),
    [dispatch, uiSpec, fieldName]
  );

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFieldName(e.target.value);
    debouncedRename(e.target.value);
  };

  const syncFieldID = () => {
    const desired = slugify(state.label || '');
    const viewId = getViewIDForField(uiSpec, fieldName);
    if (viewId && desired && desired !== fieldName) {
      setLocalFieldName(desired);
      dispatch(fieldRenamed({viewId, fieldName, newFieldName: desired}));
    }
  };

  useEffect(() => {
    if (isMounted.current) {
      idInputRef.current?.focus();
    } else {
      isMounted.current = true;
    }
    setLocalFieldName(fieldName);
  }, [fieldName]);

  const getFieldLabel = () => {
    return (
      field['component-parameters']?.label ?? field['component-parameters'].name
    );
  };

  const setFieldLabel = (newField: FieldType, label: string) => {
    newField['component-parameters'].label = label;
  };

  const updateField = (fieldName: string, newField: FieldType) => {
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const cParams = field['component-parameters'];

  const protectionSetting = cParams.protection || 'none';
  const protectionEnabled = protectionSetting !== 'none';
  const allowHidingEnabled = protectionSetting === 'allow-hiding';

  const state: StateType = {
    label: getFieldLabel(),
    helperText: cParams.helperText || '',
    advancedHelperText: cParams.advancedHelperText || '',
    required: cParams.required || false,
    annotation: field.meta?.annotation?.include || false,
    annotationLabel: field.meta?.annotation?.label || '',
    uncertainty: field.meta?.uncertainty?.include || false,
    uncertaintyLabel: field.meta?.uncertainty?.label || '',
    condition: field.condition,
    persistent: field.persistent || false,
    displayParent: field.displayParent || false,
    protection: protectionEnabled,
    allowHiding: allowHidingEnabled,
  };

  const hasAdvancedSupport = showHelperText;

  const [showAdvanced, setShowAdvanced] = useState(
    hasAdvancedSupport &&
      !!cParams.advancedHelperText &&
      cParams.advancedHelperText !== ''
  );
  const [expanded, setExpanded] = useState(true);

  const updateFieldFromState = (newState: StateType) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;

    if (newState.label !== undefined) {
      setFieldLabel(newField, newState.label);
    }

    newField['component-parameters'].helperText = newState.helperText;
    newField['component-parameters'].required = newState.required;
    newField['component-parameters'].advancedHelperText =
      newState.advancedHelperText;

    if (newField.meta) {
      newField.meta.annotation = {
        include: newState.annotation,
        label: newState.annotationLabel || '',
      };
      newField.meta.uncertainty = {
        include: newState.uncertainty,
        label: newState.uncertaintyLabel || '',
      };
    }

    if (newState.protection) {
      newField['component-parameters'].protection = newState.allowHiding
        ? 'allow-hiding'
        : 'protected';
    } else {
      newField['component-parameters'].protection = 'none';
    }

    newField.persistent = newState.persistent || false;
    newField.displayParent = newState.displayParent || false;

    updateField(fieldName, newField);
  };

  const updateProperty = (prop: string, value: string | boolean) => {
    const newState: StateType = {...state, [prop]: value};
    updateFieldFromState(newState);
  };

  const conditionChanged = (condition: ConditionType | null) => {
    dispatch(fieldConditionChanged({fieldName, condition}));
  };

  const isSpeechEnabled = checkSpeechEnabled(field);
  const hasCondition = !!state.condition;
  const sectionSubLabel = hasCondition && isSpeechEnabled
    ? 'Conditions + voice to text'
    : hasCondition
    ? 'Conditions'
    : isSpeechEnabled
    ? 'Voice to text'
    : 'No conditions';

  const speechSettings = isSpeechEnabled ? getSpeechSettings(field) : null;

  return (
    <Grid container spacing={2}>
      {/* ── Top card: Label / Field ID / Helper Text / type-specific children ── */}
      <Grid item xs={12}>
        <Card variant="outlined" sx={{p: 2}}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box display="flex" flexDirection="column" gap={2}>
                <DebouncedTextField
                  fullWidth
                  label="Label"
                  value={state.label}
                  onChange={e => updateProperty('label', e.target.value)}
                  inputProps={{'data-field-label-input': 'true'}}
                />
                <TextField
                  fullWidth
                  label="Field ID"
                  value={localFieldName}
                  onChange={handleIdChange}
                  inputRef={idInputRef}
                  InputProps={{
                    endAdornment:
                      state.label && slugify(state.label) !== localFieldName ? (
                        <InputAdornment position="end">
                          <Tooltip title="Sync with field name">
                            <IconButton
                              size="small"
                              onClick={syncFieldID}
                              edge="end"
                            >
                              <SyncIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ) : undefined,
                  }}
                />
              </Box>
            </Grid>
            {showHelperText && (
              <Grid item xs={12} md={8}>
                <DebouncedTextField
                  fullWidth
                  label="Helper Text"
                  value={state.helperText}
                  multiline
                  rows={2}
                  onChange={e => updateProperty('helperText', e.target.value)}
                />
                {hasAdvancedSupport && (
                  <>
                    <Box mt={2}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={showAdvanced}
                            onChange={e => setShowAdvanced(e.target.checked)}
                            sx={designerCheckboxSx}
                          />
                        }
                        label="Include advanced helper text"
                      />
                    </Box>

                    {showAdvanced && (
                      <Card variant="outlined" sx={{mt: 2, p: 2}}>
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Typography variant="subtitle2" fontWeight="bold">
                            Advanced Helper Text (Markdown)
                          </Typography>
                          <IconButton
                            onClick={() => setExpanded(!expanded)}
                            size="small"
                            aria-label="Toggle advanced editor"
                          >
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>

                        <Collapse in={expanded}>
                          <Box mt={2}>
                            <MdxEditor
                              initialMarkdown={state.advancedHelperText}
                              handleChange={debounce(
                                markdown =>
                                  updateProperty('advancedHelperText', markdown),
                                500,
                                {leading: false, trailing: true}
                              )}
                              editorRef={mdxEditorRef}
                            />
                            <Alert severity="info" sx={{mt: 2}}>
                              This markdown-based helper will appear in a dialog
                              when users click the info icon next to the field
                              label in the app.
                            </Alert>
                          </Box>
                        </Collapse>
                      </Card>
                    )}
                  </>
                )}
              </Grid>
            )}

            {children && (
              <Grid item xs={12}>
                {children}
              </Grid>
            )}
          </Grid>
        </Card>
      </Grid>

      {/* ── General field settings card ── */}
      {showExtraConfig && (
        <Grid item xs={12}>
          <Card variant="outlined" sx={{overflow: 'hidden'}}>
            {/* Section subheading strip */}
            <Box
              sx={{
                px: 2,
                py: 0.9,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: theme => alpha(theme.palette.primary.main, 0.04),
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.secondary',
                  fontSize: '0.78rem',
                  letterSpacing: '0.02em',
                }}
              >
                General Field settings —{' '}
                <Box component="span" sx={{color: 'text.primary'}}>
                  {sectionSubLabel}
                </Box>
              </Typography>
            </Box>

            <Grid container>
              {/* LEFT: Required + Condition button + condition display */}
              <Grid
                item
                xs={12}
                md={6}
                sx={{
                  p: 2,
                  borderRight: {md: '1px solid'},
                  borderColor: {md: 'divider'},
                  borderBottom: {xs: '1px solid', md: 'none'},
                }}
              >
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={state.required}
                        onChange={e =>
                          updateProperty('required', e.target.checked)
                        }
                        sx={designerCheckboxSx}
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={600}>
                        Required
                      </Typography>
                    }
                  />
                  <ConditionModal
                    label={
                      state.condition ? 'Update condition' : 'Add condition'
                    }
                    initial={state.condition}
                    onChange={conditionChanged}
                    field={fieldName}
                    buttonSx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                    }}
                  />
                </Stack>

                {state.condition && (
                  <Box
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      bgcolor: theme => alpha(theme.palette.info.main, 0.06),
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: theme => alpha(theme.palette.info.main, 0.22),
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{fontWeight: 600, color: 'text.secondary'}}
                    >
                      Show this field if{' '}
                    </Typography>
                    <Typography variant="caption" color="text.primary">
                      <ConditionTranslation condition={state.condition} />
                    </Typography>
                  </Box>
                )}
              </Grid>

              {/* RIGHT: Advanced controls + voice-to-text */}
              <Grid item xs={12} md={6} sx={{p: 2}}>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{mb: 1.5, color: 'text.primary'}}
                >
                  Advanced controls
                </Typography>

                <Grid container rowGap={0.25}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      sx={{alignItems: 'center'}}
                      control={
                        <Checkbox
                          checked={state.displayParent}
                          onChange={e =>
                            updateProperty('displayParent', e.target.checked)
                          }
                          sx={designerCheckboxSx}
                          size="small"
                        />
                      }
                      label={
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.4}}>
                          <Typography variant="body2">
                            Display in child records
                          </Typography>
                          <Tooltip title="When enabled, this field's value will be visible in child records linked to this record.">
                            <InfoIcon sx={designerInfoIconSx} />
                          </Tooltip>
                        </Box>
                      }
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      sx={{alignItems: 'center'}}
                      control={
                        <Checkbox
                          checked={state.persistent}
                          onChange={e =>
                            updateProperty('persistent', e.target.checked)
                          }
                          sx={designerCheckboxSx}
                          size="small"
                        />
                      }
                      label={
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.4}}>
                          <Typography variant="body2">
                            Copy value to new records
                          </Typography>
                          <Tooltip title="When enabled, the value entered in this field will be automatically copied when creating new records.">
                            <InfoIcon
                              sx={designerInfoIconSx}
                            />
                          </Tooltip>
                        </Box>
                      }
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      sx={{alignItems: 'center'}}
                      control={
                        <Checkbox
                          checked={state.annotation}
                          onChange={e =>
                            updateProperty('annotation', e.target.checked)
                          }
                          sx={designerCheckboxSx}
                          size="small"
                        />
                      }
                      label={
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.4}}>
                          <Typography variant="body2">Annotation</Typography>
                          <Tooltip title="Allows users to add a note alongside the field value when filling out the form.">
                            <InfoIcon
                              sx={designerInfoIconSx}
                            />
                          </Tooltip>
                        </Box>
                      }
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      sx={{alignItems: 'center'}}
                      control={
                        <Checkbox
                          checked={state.uncertainty}
                          onChange={e =>
                            updateProperty('uncertainty', e.target.checked)
                          }
                          sx={designerCheckboxSx}
                          size="small"
                        />
                      }
                      label={
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.4}}>
                          <Typography variant="body2">Uncertainty</Typography>
                          <Tooltip title="Allows users to indicate confidence in the entered value.">
                            <InfoIcon sx={designerInfoIconSx} />
                          </Tooltip>
                        </Box>
                      }
                    />
                  </Grid>
                </Grid>

                {/* Annotation / Uncertainty label inputs */}
                {(state.annotation || state.uncertainty) && (
                  <Grid container spacing={1.5} sx={{mt: 0.5}}>
                    {state.annotation && (
                      <Grid item xs={12} sm={6}>
                        <DebouncedTextField
                          fullWidth
                          size="small"
                          label="Annotation Label"
                          value={state.annotationLabel}
                          onChange={e =>
                            updateProperty('annotationLabel', e.target.value)
                          }
                        />
                      </Grid>
                    )}
                    {state.uncertainty && (
                      <Grid item xs={12} sm={6}>
                        <DebouncedTextField
                          fullWidth
                          size="small"
                          label="Uncertainty Label"
                          value={state.uncertaintyLabel}
                          onChange={e =>
                            updateProperty('uncertaintyLabel', e.target.value)
                          }
                        />
                      </Grid>
                    )}
                  </Grid>
                )}

                {/* Voice-to-text inline (only for speech-enabled fields) */}
                {isSpeechEnabled && speechSettings && (
                  <Box
                    sx={{
                      mt: 2,
                      pt: 2,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        mb: 0.75,
                      }}
                    >
                      <MicIcon sx={{fontSize: '1rem', color: 'text.secondary'}} />
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color="text.primary"
                      >
                        Voice-to-text
                      </Typography>
                    </Box>

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={speechSettings.enableSpeech}
                          onChange={e => {
                            const newField = updateSpeechSettings(field, {
                              enableSpeech: e.target.checked,
                            });
                            dispatch(fieldUpdated({fieldName, newField}));
                          }}
                          sx={designerCheckboxSx}
                          size="small"
                        />
                      }
                      label={
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.4}}>
                          <Typography variant="body2">
                            Enable voice-to-text input for this field
                          </Typography>
                          <Tooltip title="When enabled, users can tap a microphone button to dictate text using their device's speech recognition. This is useful for hands-free data entry in the field.">
                            <InfoIcon sx={designerInfoIconSx} />
                          </Tooltip>
                        </Box>
                      }
                    />

                    {speechSettings.enableSpeech && (
                      <Box sx={{pl: 4}}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={speechSettings.speechAppendMode}
                              onChange={e => {
                                const newField = updateSpeechSettings(field, {
                                  speechAppendMode: e.target.checked,
                                });
                                dispatch(fieldUpdated({fieldName, newField}));
                              }}
                              sx={designerCheckboxSx}
                              size="small"
                            />
                          }
                          label={
                            <Box
                              sx={{display: 'flex', alignItems: 'center', gap: 0.4}}
                            >
                              <Typography variant="body2">
                                Append text to the end of input instead of replacing
                              </Typography>
                              <Tooltip title="When enabled, each speech recognition result will be added to the end of any existing text in the field. When disabled, new speech input replaces the current value.">
                                <InfoIcon sx={designerInfoIconSx} />
                              </Tooltip>
                            </Box>
                          }
                        />
                      </Box>
                    )}
                  </Box>
                )}
              </Grid>
            </Grid>

            {/* Template protection — bottom strip (only when VITE_TEMPLATE_PROTECTIONS is on) */}
            {VITE_TEMPLATE_PROTECTIONS && (
              <Box sx={{px: 2, pb: 2, pt: 0}}>
                <Divider sx={{mb: 1.5}} />
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={state.protection}
                            onChange={e =>
                              updateProperty('protection', e.target.checked)
                            }
                            sx={designerCheckboxSx}
                            size="small"
                          />
                        }
                        label="Protected Field"
                      />
                      <Tooltip title="Enable protection to prevent users of this template (or derived templates) from editing or deleting this field.">
                        <InfoIcon
                          sx={designerInfoIconSx}
                        />
                      </Tooltip>
                    </Box>
                  </Grid>
                  {state.protection && (
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={state.allowHiding}
                            onChange={e =>
                              updateProperty('allowHiding', e.target.checked)
                            }
                            sx={designerCheckboxSx}
                            size="small"
                          />
                        }
                        label="Allow Hiding"
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </Card>
        </Grid>
      )}
    </Grid>
  );
};
