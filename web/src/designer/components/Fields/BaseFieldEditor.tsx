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
import {SimpleFieldWrapper} from './SimpleFieldWrapper';
import {getSpeechSettings, updateSpeechSettings} from './SpeechSettingsEditor';
import {slugify} from '../../domain/notebook/ids';
import {
  designerCheckboxSx,
  designerInfoCalloutSx,
  designerInfoIconSx,
  designerSoftPanelCardSx,
} from '../designer-style';

/** `component-namespace::component-name` keys eligible for speech settings in the inspector. */
export const SPEECH_ENABLED_FIELDS = ['faims-custom::TextField'];

/** True if {@link SPEECH_ENABLED_FIELDS} includes this field's composite type key. */
const checkSpeechEnabled = (field: FieldType) => {
  return SPEECH_ENABLED_FIELDS.includes(
    `${field['component-namespace']}::${field['component-name']}`
  );
};
const FIRST_AUTO_SYNC_DELAY_MS = 700;
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
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const uiSpec = useAppSelector(state => state.notebook.uiSpec.present);
  const dispatch = useAppDispatch();
  const mdxEditorRef = useRef<MDXEditorMethods>(null);
  // The exact markdown the editor itself last emitted via onChange. The sync
  // effect uses this to tell our own edits (echoed back through the store) from
  // genuinely external changes such as undo/redo. We must NOT compare against
  // mdxEditorRef.getMarkdown(): the editor re-serializes (e.g. trailing
  // newline/escaping) so it never exactly equals the stored string, which would
  // make the effect fire setMarkdown on every keystroke — and since setMarkdown
  // re-emits onChange, that becomes a setMarkdown→onChange→setMarkdown loop
  // (the visible flicker).
  const lastEditorMarkdownRef = useRef(
    field['component-parameters'].advancedHelperText || ''
  );

  const idInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(false);
  // Enable one-time auto-sync (Label -> Field ID) for newly added fields only.
  const autoSyncFieldIdEnabled = useRef(true);
  const initialAutoSyncDone = useRef(false);
  // Mark renames triggered by auto-sync (not by user changing selected field).
  const internalRenameInFlight = useRef(false);
  const labelSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localFieldName, setLocalFieldName] = useState(fieldName);

  const debouncedRename = useCallback(
    debounce((newFieldName: string) => {
      const viewId = getViewIDForField(uiSpec, fieldName);
      if (viewId && newFieldName.trim() && newFieldName.trim() !== fieldName) {
        internalRenameInFlight.current = true;
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
    // User is explicitly controlling Field ID, so pause auto-sync from label.
    autoSyncFieldIdEnabled.current = false;
    initialAutoSyncDone.current = true;
    setLocalFieldName(e.target.value);
    debouncedRename(e.target.value);
  };

  const syncFieldIDToLabel = (label: string) => {
    const desired = slugify(label || '');
    const viewId = getViewIDForField(uiSpec, fieldName);
    if (viewId && desired && desired !== fieldName) {
      internalRenameInFlight.current = true;
      setLocalFieldName(desired);
      dispatch(fieldRenamed({viewId, fieldName, newFieldName: desired}));
    }
  };

  const syncFieldID = () => {
    // Manual sync is one-shot and should not re-enable continuous auto-sync.
    autoSyncFieldIdEnabled.current = false;
    initialAutoSyncDone.current = true;
    syncFieldIDToLabel(state.label || '');
  };

  const handleLabelChange = (newLabel: string) => {
    updateProperty('label', newLabel);

    // - do one automatic Label -> Field ID sync for fresh fields
    // - only after the user pauses typing
    // - never keep re-syncing forever while they continue editing label text
    if (autoSyncFieldIdEnabled.current && !initialAutoSyncDone.current) {
      if (labelSyncTimerRef.current) {
        clearTimeout(labelSyncTimerRef.current);
      }
      labelSyncTimerRef.current = setTimeout(() => {
        syncFieldIDToLabel(newLabel);
        initialAutoSyncDone.current = true;
        autoSyncFieldIdEnabled.current = false;
        labelSyncTimerRef.current = null;
      }, FIRST_AUTO_SYNC_DELAY_MS);
    }
  };

  const handleLabelBlur = () => {
    // Flush pending one-time auto-sync immediately on blur.
    if (labelSyncTimerRef.current) {
      clearTimeout(labelSyncTimerRef.current);
      labelSyncTimerRef.current = null;
    }
    if (autoSyncFieldIdEnabled.current && !initialAutoSyncDone.current) {
      syncFieldIDToLabel(state.label || '');
      initialAutoSyncDone.current = true;
      autoSyncFieldIdEnabled.current = false;
    }
  };

  useEffect(() => {
    const wasInternalRename = internalRenameInFlight.current;
    internalRenameInFlight.current = false;

    // "New-Field*" means this field was just created by designer scaffolding.
    // We allow first-time auto-sync only for this new-field state.
    const isFreshGeneratedFieldId = /^New-Field(?:-\d+)?$/i.test(fieldName);
    autoSyncFieldIdEnabled.current = isFreshGeneratedFieldId;
    initialAutoSyncDone.current = !isFreshGeneratedFieldId;

    setLocalFieldName(fieldName);

    if (isMounted.current && !wasInternalRename) {
      // Focus policy:
      // when user lands on a new field, keep them in Label first (fast naming flow);
      // do not jump focus to Field ID because that interrupts editing.
      window.setTimeout(() => {
        labelInputRef.current?.focus();
      }, 0);
    } else {
      isMounted.current = true;
    }
  }, [fieldName]);

  useEffect(() => {
    return () => {
      if (labelSyncTimerRef.current) {
        clearTimeout(labelSyncTimerRef.current);
      }
      debouncedRename.cancel();
    };
  }, [debouncedRename]);

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

  // The MDX editor is uncontrolled (it reads `initialMarkdown` only once on
  // mount), so it ignores store changes that originate outside the editor —
  // most importantly global undo/redo, but also switching fields. When the
  // store value differs from what the editor last emitted, the change is
  // external, so push it into the editor imperatively. When they match, it is
  // just our own debounced edit echoing back, so we leave the editor alone and
  // the caret is never disturbed (and no setMarkdown→onChange loop occurs).
  useEffect(() => {
    if (state.advancedHelperText === lastEditorMarkdownRef.current) return;
    lastEditorMarkdownRef.current = state.advancedHelperText;
    mdxEditorRef.current?.setMarkdown(state.advancedHelperText || '');
  }, [state.advancedHelperText]);

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
  const speechSettings = isSpeechEnabled ? getSpeechSettings(field) : null;
  const isChoiceField =
    field['component-name'] === 'Select' ||
    field['component-name'] === 'MultiSelect';
  // Always use the unified wrapper pattern so labels are rendered as headings
  // above inputs (no floating labels), even for legacy/deprecated field types.
  const useUnifiedFieldWrapper = true;

  return (
    <Grid container spacing={2}>
      {/* ── Top card: Label / Field ID / Helper Text / type-specific children ── */}
      <Grid size={12}>
        <Card
          variant="outlined"
          sx={
            useUnifiedFieldWrapper
              ? {
                  p: 2,
                  ...(designerSoftPanelCardSx as Record<string, unknown>),
                }
              : {p: 2}
          }
        >
          <Grid container spacing={2}>
            <Grid size={{xs: 12, md: 4}}>
              <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                {isChoiceField ? (
                  <>
                    <SimpleFieldWrapper heading="Label">
                      <DebouncedTextField
                        fullWidth
                        label=""
                        placeholder="Enter field label"
                        value={state.label}
                        onChange={e => handleLabelChange(e.target.value)}
                        onBlur={handleLabelBlur}
                        inputRef={labelInputRef}
                        slotProps={{
                          htmlInput: {'data-field-label-input': 'true'},
                        }}
                      />
                    </SimpleFieldWrapper>
                    <SimpleFieldWrapper heading="Field ID">
                      <TextField
                        fullWidth
                        label=""
                        placeholder="Enter field ID"
                        value={localFieldName}
                        onChange={handleIdChange}
                        inputRef={idInputRef}
                        slotProps={{
                          input: {
                            endAdornment:
                              state.label &&
                              slugify(state.label) !== localFieldName ? (
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
                          },
                        }}
                      />
                    </SimpleFieldWrapper>
                  </>
                ) : (
                  <>
                    {useUnifiedFieldWrapper ? (
                      <>
                        <SimpleFieldWrapper heading="Label">
                          <DebouncedTextField
                            fullWidth
                            label=""
                            placeholder="Enter field label"
                            value={state.label}
                            onChange={e => handleLabelChange(e.target.value)}
                            onBlur={handleLabelBlur}
                            inputRef={labelInputRef}
                            slotProps={{
                              htmlInput: {'data-field-label-input': 'true'},
                            }}
                          />
                        </SimpleFieldWrapper>
                        <SimpleFieldWrapper heading="Field ID">
                          <TextField
                            fullWidth
                            label=""
                            placeholder="Enter field ID"
                            value={localFieldName}
                            onChange={handleIdChange}
                            inputRef={idInputRef}
                            slotProps={{
                              input: {
                                endAdornment:
                                  state.label &&
                                  slugify(state.label) !== localFieldName ? (
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
                              },
                            }}
                          />
                        </SimpleFieldWrapper>
                      </>
                    ) : (
                      <>
                        <DebouncedTextField
                          fullWidth
                          label="Label"
                          value={state.label}
                          onChange={e => handleLabelChange(e.target.value)}
                          onBlur={handleLabelBlur}
                          inputRef={labelInputRef}
                          slotProps={{
                            htmlInput: {'data-field-label-input': 'true'},
                          }}
                        />
                        <TextField
                          fullWidth
                          label="Field ID"
                          value={localFieldName}
                          onChange={handleIdChange}
                          inputRef={idInputRef}
                          slotProps={{
                            input: {
                              endAdornment:
                                state.label &&
                                slugify(state.label) !== localFieldName ? (
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
                            },
                          }}
                        />
                      </>
                    )}
                  </>
                )}
              </Box>
            </Grid>
            {showHelperText && (
              <Grid size={{xs: 12, md: 8}}>
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                  {useUnifiedFieldWrapper ? (
                    <SimpleFieldWrapper heading="Helper Text">
                      <DebouncedTextField
                        fullWidth
                        label=""
                        placeholder="Enter helper text"
                        value={state.helperText}
                        multiline
                        rows={2}
                        onChange={e =>
                          updateProperty('helperText', e.target.value)
                        }
                      />
                    </SimpleFieldWrapper>
                  ) : (
                    <DebouncedTextField
                      fullWidth
                      label="Helper Text"
                      value={state.helperText}
                      multiline
                      rows={2}
                      onChange={e =>
                        updateProperty('helperText', e.target.value)
                      }
                    />
                  )}
                  {hasAdvancedSupport && (
                    <>
                      <Box>
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
                        <Card
                          variant="outlined"
                          sx={
                            useUnifiedFieldWrapper
                              ? {
                                  p: 2,
                                  overflow: 'visible',
                                  borderColor: 'divider',
                                  boxShadow: theme =>
                                    `0 1px 6px ${alpha(
                                      theme.palette.common.black,
                                      0.08
                                    )}, inset 0 1px 2px ${alpha(
                                      theme.palette.common.black,
                                      0.04
                                    )}`,
                                }
                              : {mt: 2, p: 2, overflow: 'visible'}
                          }
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography
                              variant="subtitle2"
                              sx={{fontWeight: 'bold'}}
                            >
                              Advanced Helper Text (Markdown)
                            </Typography>
                            <IconButton
                              onClick={() => setExpanded(!expanded)}
                              size="small"
                              aria-label="Toggle advanced editor"
                            >
                              {expanded ? (
                                <ExpandLessIcon />
                              ) : (
                                <ExpandMoreIcon />
                              )}
                            </IconButton>
                          </Box>

                          <Collapse
                            in={expanded}
                            sx={{
                              overflow: 'visible',
                              '& .MuiCollapse-wrapper': {overflow: 'visible'},
                              '& .MuiCollapse-wrapperInner': {
                                overflow: 'visible',
                              },
                            }}
                          >
                            <Box sx={{mt: 2, overflow: 'visible'}}>
                              <MdxEditor
                                initialMarkdown={state.advancedHelperText}
                                handleChange={debounce(
                                  markdown => {
                                    // Ignore the echo that a programmatic
                                    // setMarkdown (undo/redo sync) re-emits: the
                                    // value is already in the store, and the sync
                                    // effect set lastEditorMarkdownRef to it
                                    // first. Re-dispatching here would push a
                                    // duplicate undo entry and wipe the redo
                                    // stack.
                                    if (
                                      markdown === lastEditorMarkdownRef.current
                                    ) {
                                      return;
                                    }
                                    // Record what the editor emitted so the sync
                                    // effect recognises the resulting store
                                    // update as our own echo, not an external
                                    // undo/redo.
                                    lastEditorMarkdownRef.current = markdown;
                                    updateProperty(
                                      'advancedHelperText',
                                      markdown
                                    );
                                  },
                                  500,
                                  {leading: false, trailing: true}
                                )}
                                editorRef={mdxEditorRef}
                              />
                              <Alert
                                severity="info"
                                sx={{
                                  ...(designerInfoCalloutSx as Record<
                                    string,
                                    unknown
                                  >),
                                  mt: 2,
                                }}
                              >
                                This markdown-based helper will appear in a
                                dialog when users click the info icon next to
                                the field label in the app. You can resize
                                inserted images by dragging their resize
                                handles.
                              </Alert>
                            </Box>
                          </Collapse>
                        </Card>
                      )}
                    </>
                  )}
                </Box>
              </Grid>
            )}

            {children && <Grid size={12}>{children}</Grid>}
          </Grid>
        </Card>
      </Grid>

      {/* ── General field settings card ── */}
      {showExtraConfig && (
        <Grid size={12}>
          <Card variant="outlined" sx={{overflow: 'hidden'}}>
            <Grid container>
              {/* LEFT: Required + Condition button + condition display.
                  Narrower than the right side because it only ever holds two
                  controls. We make the column itself a vertical flex
                  container so its contents sit centered against the taller
                  right column — the right side may grow when Voice-to-text
                  is visible, and we don't want Required/Add condition to
                  ride at the top of that empty space. */}
              <Grid
                size={{xs: 12, md: 4}}
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  borderRight: {md: '1px solid'},
                  borderColor: {md: 'divider'},
                  borderBottom: {xs: '1px solid', md: 'none'},
                }}
              >
                <Stack
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    gap: 2,
                    flexWrap: 'wrap',
                  }}
                >
                  <FormControlLabel
                    sx={{mr: 0}}
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
                      <Typography variant="body2" sx={{fontWeight: 600}}>
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
                      ...(designerInfoCalloutSx as Record<string, unknown>),
                      p: 1.5,
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

              {/* RIGHT: Advanced controls + voice-to-text. Takes the
                  remaining two-thirds of the row since it has four toggles
                  plus the speech section to lay out. */}
              <Grid size={{xs: 12, md: 8}} sx={{p: 2}}>
                <Typography
                  variant="body2"
                  sx={{mb: 0.5, color: 'text.primary', fontWeight: 700}}
                >
                  Advanced controls
                </Typography>

                {/*
                 * Pack the four advanced toggles as natural-width flex items so
                 * the right pair sits immediately next to the left pair instead
                 * of stretching to a 50/50 grid column. Wraps to 2x2 (or even
                 * a single column on mobile) when the card is narrow.
                 */}
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    columnGap: 3,
                    rowGap: 1.25,
                    mt: 0.5,
                  }}
                >
                  <FormControlLabel
                    sx={{alignItems: 'center', mr: 0}}
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
                      <Box
                        sx={{display: 'flex', alignItems: 'center', gap: 0.4}}
                      >
                        <Typography variant="body2">
                          Display in child records
                        </Typography>
                        <Tooltip title="When enabled, this field's value will be visible in child records linked to this record.">
                          <InfoIcon sx={designerInfoIconSx} />
                        </Tooltip>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    sx={{alignItems: 'center', mr: 0}}
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
                      <Box
                        sx={{display: 'flex', alignItems: 'center', gap: 0.4}}
                      >
                        <Typography variant="body2">
                          Copy value to new records
                        </Typography>
                        <Tooltip title="When enabled, the value entered in this field will be automatically copied when creating new records.">
                          <InfoIcon sx={designerInfoIconSx} />
                        </Tooltip>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    sx={{alignItems: 'center', mr: 0}}
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
                      <Box
                        sx={{display: 'flex', alignItems: 'center', gap: 0.4}}
                      >
                        <Typography variant="body2">Annotation</Typography>
                        <Tooltip title="Allows users to add a note alongside the field value when filling out the form.">
                          <InfoIcon sx={designerInfoIconSx} />
                        </Tooltip>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    sx={{alignItems: 'center', mr: 0}}
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
                      <Box
                        sx={{display: 'flex', alignItems: 'center', gap: 0.4}}
                      >
                        <Typography variant="body2">Uncertainty</Typography>
                        <Tooltip title="Allows users to indicate confidence in the entered value.">
                          <InfoIcon sx={designerInfoIconSx} />
                        </Tooltip>
                      </Box>
                    }
                  />
                </Box>

                {/* Annotation / Uncertainty label inputs */}
                {(state.annotation || state.uncertainty) && (
                  <Grid container spacing={1.5} sx={{mt: 0.5}}>
                    {state.annotation && (
                      <Grid size={{xs: 12, sm: 6}}>
                        <SimpleFieldWrapper heading="Annotation Label">
                          <DebouncedTextField
                            fullWidth
                            size="small"
                            label=""
                            placeholder="Annotation label"
                            value={state.annotationLabel}
                            onChange={e =>
                              updateProperty('annotationLabel', e.target.value)
                            }
                          />
                        </SimpleFieldWrapper>
                      </Grid>
                    )}
                    {state.uncertainty && (
                      <Grid size={{xs: 12, sm: 6}}>
                        <SimpleFieldWrapper heading="Uncertainty Label">
                          <DebouncedTextField
                            fullWidth
                            size="small"
                            label=""
                            placeholder="Uncertainty label"
                            value={state.uncertaintyLabel}
                            onChange={e =>
                              updateProperty('uncertaintyLabel', e.target.value)
                            }
                          />
                        </SimpleFieldWrapper>
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
                      <MicIcon
                        sx={{fontSize: '1rem', color: 'text.secondary'}}
                      />
                      <Typography
                        variant="body2"
                        color="text.primary"
                        sx={{fontWeight: 700}}
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
                        <Box
                          sx={{display: 'flex', alignItems: 'center', gap: 0.4}}
                        >
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
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.4,
                              }}
                            >
                              <Typography variant="body2">
                                Append text to the end of input instead of
                                replacing
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
                  <Grid size={{xs: 12, sm: 6}}>
                    <Box sx={{display: 'flex', alignItems: 'center'}}>
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
                        <InfoIcon sx={designerInfoIconSx} />
                      </Tooltip>
                    </Box>
                  </Grid>
                  {state.protection && (
                    <Grid size={{xs: 12, sm: 6}}>
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
