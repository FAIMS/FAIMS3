import {
  AvpUpdateMode,
  currentlyVisibleMap,
  FaimsAttachments,
  FormDataEntry,
  getFormLabel,
  HydratedRecordDocument,
} from '@faims3/data-model';
import CheckIcon from '@mui/icons-material/Check';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import {useForm} from '@tanstack/react-form';
import {debounce, DebouncedFunc} from 'lodash';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {formDataExtractor} from '../../utils';
import {CompiledFormSchema, FormValidation} from '../../validationModule';
import {FaimsForm, FaimsFormData} from '../types';
import {LiveFormProgress} from './components/FormProgress';
import {FormBreadcrumbs} from './navigation/NavigationBreadcrumbs';
import {FormManager} from './FormManager';
import {
  getRecordContextFromRecord,
  onChangeTemplatedFields,
} from './templatedFields';
import {
  FieldVisibilityMap,
  FormNavigationContext,
  FullFormConfig,
  FullFormManagerConfig,
} from './types';
import {initializeAutoIncrementFields} from './utils/autoIncrementInitializer';

// Navigation module imports
import {
  NavigationButtonsDisplay,
  useNavigationDataPreparation,
  useNavigationLogic,
} from './navigation';

// ============================================================================
// Constants
// ============================================================================

/**
 * Debounce time for form syncs to prevent excessive updates to the backend.
 * Changes are batched and saved after this delay (in milliseconds).
 */
const FORM_SYNC_DEBOUNCE_MS = 1000;

/** Shorter debounce for responsive UI feedback */
const VISIBILITY_DEBOUNCE_MS = 150;

// ============================================================================
// Types
// ============================================================================

export type ValidationMode = 'FULL' | 'ONLY_TOUCHED';

export interface EditableFormManagerProps {
  /** The record ID being edited */
  recordId: string;
  /** The currently active user */
  activeUser: string;
  /** The initial data to load into the form */
  initialData?: FaimsFormData;
  /** The existing record - this helps build contextual infills */
  existingRecord: HydratedRecordDocument;
  /** The initial revision ID to work on */
  revisionId: string;
  /** The form we are editing */
  formId: string;
  /** Update mode - determines revision creation behavior */
  mode: AvpUpdateMode;
  /** Full configuration with data engine access */
  config: FullFormConfig;
  /** Information about the navigational context */
  navigationContext: FormNavigationContext;
  /** Called when the form is ready, providing access to form controls */
  onReady?: (handle: EditableFormManagerHandle) => void;
  /** Insertable heading slot */
  headingSlot?: React.ReactNode;
  /** Enable debug logging for save operations */
  debugMode?: boolean;
}

export interface EditableFormManagerHandle {
  flushSave: () => Promise<void>;
  hasPendingChanges: () => boolean;
}

// ============================================================================
// Component
// ============================================================================

export const EditableFormManager: React.FC<
  EditableFormManagerProps
> = props => {
  const {debugMode = false, onReady} = props;

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
    setErrorOpen(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Revision & Edit State
  // ---------------------------------------------------------------------------
  const [edited, setEdited] = useState(false);
  const [workingRevisionId, setWorkingRevisionId] = useState(props.revisionId);
  const autoIncrementInitializedRef = useRef(false);

  const validationMode: ValidationMode =
    props.mode === 'new' ? 'ONLY_TOUCHED' : 'FULL';

  // ---------------------------------------------------------------------------
  // Data Engine
  // ---------------------------------------------------------------------------
  const dataEngine = useMemo(
    () => props.config.dataEngine(),
    [props.config.dataEngine]
  );

  // ---------------------------------------------------------------------------
  // Visibility Tracking
  // ---------------------------------------------------------------------------
  const [visibleMap, setVisibleMap] = useState<FieldVisibilityMap>(
    currentlyVisibleMap({
      values: formDataExtractor({fullData: props.initialData ?? {}}),
      uiSpec: dataEngine.uiSpec,
      viewsetId: props.formId,
    })
  );

  const validationSchema = useRef<CompiledFormSchema>(
    FormValidation.compileFormSchema({
      uiSpec: dataEngine.uiSpec,
      formId: props.formId,
      config: {visibleBehaviour: 'include'},
    })
  );

  // ---------------------------------------------------------------------------
  // Save State Tracking
  // ---------------------------------------------------------------------------
  const pendingValuesRef = useRef(false);
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  // ---------------------------------------------------------------------------
  // Revision Management
  // ---------------------------------------------------------------------------
  const ensureWorkingRevision = useCallback(async (): Promise<string> => {
    let relevantRevisionId = workingRevisionId;

    if (!edited && props.mode === 'parent') {
      try {
        const newRevision = await dataEngine.form.createRevision({
          recordId: props.recordId,
          revisionId: workingRevisionId,
          createdBy: props.activeUser,
        });
        setWorkingRevisionId(newRevision._id);
        relevantRevisionId = newRevision._id;
      } catch (error) {
        console.error('Failed to create revision:', error);
        throw error;
      }
    }

    if (!edited) {
      setEdited(true);
    }

    return relevantRevisionId;
  }, [
    edited,
    workingRevisionId,
    props.mode,
    props.recordId,
    props.activeUser,
    dataEngine,
  ]);

  // ---------------------------------------------------------------------------
  // Visibility Updates
  // ---------------------------------------------------------------------------
  const updateVisibility = useCallback(() => {
    setVisibleMap(
      currentlyVisibleMap({
        values: formDataExtractor({fullData: form.state.values}),
        uiSpec: dataEngine.uiSpec,
        viewsetId: props.formId,
      })
    );
  }, [dataEngine.uiSpec, props.formId]);

  const debouncedUpdateVisibility = useMemo(
    () => debounce(updateVisibility, VISIBILITY_DEBOUNCE_MS),
    [updateVisibility]
  );

  useEffect(() => {
    return () => debouncedUpdateVisibility.cancel();
  }, [debouncedUpdateVisibility]);

  // ---------------------------------------------------------------------------
  // Save Implementation
  // ---------------------------------------------------------------------------
  const performSave = useCallback(async () => {
    if (debugMode) {
      console.log('[EditableFormManager] performSave called');
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const revisionToUpdate = await ensureWorkingRevision();

      onChangeTemplatedFields({
        form: form as FaimsForm,
        formId: props.formId,
        uiSpec: dataEngine.uiSpec,
        runListeners: false,
        context: getRecordContextFromRecord({record: props.existingRecord}),
      });

      await dataEngine.form.updateRevision({
        revisionId: revisionToUpdate,
        recordId: props.recordId,
        updatedBy: props.activeUser,
        update: form.state.values ?? {},
        mode: props.mode,
      });

      pendingValuesRef.current = false;
    } catch (error) {
      console.error('Failed to update revision:', error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [
    debugMode,
    ensureWorkingRevision,
    props.recordId,
    props.activeUser,
    props.mode,
    props.formId,
    props.existingRecord,
    dataEngine,
  ]);

  const performSaveRef = useRef(performSave);
  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  // ---------------------------------------------------------------------------
  // Debounced Save
  // ---------------------------------------------------------------------------
  const debouncedSaveRef = useRef<DebouncedFunc<() => Promise<void>> | null>(
    null
  );

  const debouncedSave = useMemo(() => {
    if (debouncedSaveRef.current) {
      debouncedSaveRef.current.cancel();
    }

    const debouncedFn = debounce(async () => {
      await performSaveRef.current();
    }, FORM_SYNC_DEBOUNCE_MS);

    debouncedSaveRef.current = debouncedFn;
    return debouncedFn;
  }, [debugMode]);

  useEffect(() => {
    return () => debouncedSave.cancel();
  }, [debouncedSave, debugMode]);

  // ---------------------------------------------------------------------------
  // Change Handler
  // ---------------------------------------------------------------------------
  const onChange = useCallback(() => {
    pendingValuesRef.current = true;
    debouncedUpdateVisibility();
    debouncedSave();
  }, [debouncedSave, debouncedUpdateVisibility]);

  // ---------------------------------------------------------------------------
  // Flush Save
  // ---------------------------------------------------------------------------
  const flushSave = useCallback(async (): Promise<void> => {
    if (debugMode) {
      console.log('[EditableFormManager] flushSave called');
    }

    debouncedSave.cancel();

    if (pendingValuesRef.current) {
      await performSaveRef.current();
    }

    // Poll the saving ref
    while (isSavingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, [debouncedSave, debugMode]);

  const hasPendingChanges = useCallback((): boolean => {
    return pendingValuesRef.current || isSavingRef.current;
  }, []);

  // ---------------------------------------------------------------------------
  // Form Validation
  // ---------------------------------------------------------------------------
  const validationFunction = useCallback(
    (value: FaimsFormData) => {
      const data = formDataExtractor({fullData: value});

      validationSchema.current = FormValidation.recompileFormSchema({
        existingSchema: validationSchema.current,
        formId: props.formId,
        uiSpec: dataEngine.uiSpec,
        data,
        config: {visibleBehaviour: 'ignore'},
      });

      let schema = validationSchema.current.schema;

      if (validationMode === 'ONLY_TOUCHED') {
        const touchedFields: string[] = [];
        for (const [k, meta] of Object.entries(form.state.fieldMeta)) {
          if (meta.isTouched) {
            touchedFields.push(k);
          }
        }
        schema = FormValidation.filterCompiledSchema({
          compiledSchema: validationSchema.current,
          fieldIds: touchedFields,
        }).schema;
      }

      const res = schema.safeParse(data);

      if (!res.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of res.error.issues) {
          const fieldPath = issue.path.join('.');
          if (!fieldErrors[fieldPath]) {
            fieldErrors[fieldPath] = issue.message;
          }
        }
        return {fields: fieldErrors};
      }
    },
    [validationMode, props.formId, dataEngine.uiSpec]
  );

  // ---------------------------------------------------------------------------
  // Expose Handle to Parent
  // ---------------------------------------------------------------------------
  useEffect(() => {
    onReady?.({flushSave, hasPendingChanges});
  }, [onReady, flushSave, hasPendingChanges]);

  // ---------------------------------------------------------------------------
  // Form Instance
  // ---------------------------------------------------------------------------
  const form = useForm({
    defaultValues: props.initialData,
    listeners: {onChange},
    validators: {
      onMount: ({value}) => validationFunction(value),
      onChange: ({value}) => validationFunction(value),
    },
  });

  // ---------------------------------------------------------------------------
  // Attachment Handlers
  // ---------------------------------------------------------------------------
  const handleAddAttachment = useCallback(
    async ({
      fieldId,
      blob,
      base64,
      contentType,
      type,
      fileFormat,
    }: {
      fieldId: string;
      blob?: Blob;
      base64?: string;
      contentType: string;
      type: 'photo' | 'file';
      fileFormat: string;
    }) => {
      if (!blob && !base64) {
        throw new Error('Either blob or base64 data must be provided');
      }

      const revisionToUse = await ensureWorkingRevision();
      if (!revisionToUse) {
        throw new Error('No working revision available for attachment');
      }

      const timestamp = new Date().toISOString();
      const filename = `${type === 'photo' ? 'photo' : 'file'}_${timestamp}.${fileFormat}`;

      let attachmentResult;
      const metadata = {
        attachmentDetails: {filename, contentType},
        recordContext: {
          recordId: props.recordId,
          revisionId: revisionToUse,
          created: timestamp,
          createdBy: props.activeUser,
        },
      };

      if (base64) {
        attachmentResult = await props.config
          .attachmentEngine()
          .storeAttachmentFromBase64({base64, metadata});
      } else if (blob) {
        attachmentResult = await props.config
          .attachmentEngine()
          .storeAttachmentFromBlob({blob, metadata});
      } else {
        throw new Error('Either blob or base64 data must be provided');
      }

      const state = form.state.values[fieldId];
      const newAttachments: FaimsAttachments = [
        {
          attachmentId: attachmentResult.identifier.id,
          filename: attachmentResult.metadata.filename,
          fileType: attachmentResult.metadata.contentType,
        },
        ...(state?.attachments ?? []),
      ];

      const newValue: FormDataEntry = {
        ...(state || {}),
        attachments: newAttachments,
      };

      form.setFieldValue(fieldId, newValue);
      return attachmentResult.identifier.id;
    },
    [
      ensureWorkingRevision,
      props.config,
      props.recordId,
      props.activeUser,
      form,
    ]
  );

  const handleRemoveAttachment = useCallback(
    async ({
      fieldId,
      attachmentId,
    }: {
      fieldId: string;
      attachmentId: string;
    }) => {
      const revisionToUse = await ensureWorkingRevision();
      if (!revisionToUse) {
        throw new Error('No working revision available for attachment removal');
      }

      const state = form.state.values[fieldId];
      if (!state?.attachments) {
        console.warn('No attachments found in field');
        return;
      }

      const newAttachments: FaimsAttachments = state.attachments.filter(
        attachment => attachment.attachmentId !== attachmentId
      );

      const newValue: FormDataEntry = {
        ...(state || {}),
        attachments: newAttachments,
      };

      form.setFieldValue(fieldId, newValue);
    },
    [ensureWorkingRevision, form]
  );

  // ---------------------------------------------------------------------------
  // Navigation Data Preparation (using refactored hook)
  // ---------------------------------------------------------------------------
  const navigationData = useNavigationDataPreparation({
    recordId: props.recordId,
    revisionId: props.revisionId,
    formId: props.formId,
    activeUser: props.activeUser,
    mode: props.mode,
    navigationContext: props.navigationContext,
    config: props.config,
    uiSpec: dataEngine.uiSpec,
    onError: handleError,
    flushSave,
  });

  // ---------------------------------------------------------------------------
  // Navigation Logic
  // ---------------------------------------------------------------------------
  const {buttons: navigationButtons, onCompleteHandler} = useNavigationLogic({
    currentFormLabel: getFormLabel({
      uiSpec: dataEngine.uiSpec,
      formId: props.formId,
    }),
    navigationType: navigationData.navigationType,
    explicitParentInfo: navigationData.explicitParentInfo,
    navigationService: {
      toRecord: props.config.navigation.toRecord,
      navigateToRecordList: props.config.navigation.navigateToRecordList,
      navigateToViewRecord: props.config.navigation.navigateToViewRecord,
    },
    flushSave,
    hasPendingChanges,
    impliedParents: navigationData.impliedParents,
    createAnotherChild: navigationData.createAnotherChild,
  });

  // ---------------------------------------------------------------------------
  // Form Manager Config
  // ---------------------------------------------------------------------------
  const formManagerConfig: FullFormManagerConfig = useMemo(
    () => ({
      ...props.config,
      onCompleteHandler,
      navigationContext: props.navigationContext,
      attachmentHandlers: {
        addAttachment: handleAddAttachment,
        removeAttachment: handleRemoveAttachment,
      },
      trigger: {
        commit: flushSave,
      },
    }),
    [
      onCompleteHandler,
      props.config,
      props.navigationContext,
      handleAddAttachment,
      handleRemoveAttachment,
      flushSave,
    ]
  );

  // ---------------------------------------------------------------------------
  // Auto-Increment Initialization
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!props.config.incrementerService) return;
    if (autoIncrementInitializedRef.current) return;

    const initialize = async () => {
      autoIncrementInitializedRef.current = true;

      await initializeAutoIncrementFields({
        form: form as FaimsForm,
        formId: props.formId,
        incrementerService: props.config.incrementerService,
        initialData: props.initialData,
        onIssue: fieldRefs => {
          props.config.incrementerService.onIssue(fieldRefs, () => {
            autoIncrementInitializedRef.current = false;
          });
        },
      });
    };

    initialize();
  }, [
    props.mode,
    props.formId,
    props.config.incrementerService,
    props.initialData,
    autoIncrementInitializedRef.current,
    props.debugMode,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Stack gap={2}>
      {/* Error Snackbar */}
      <Snackbar
        open={errorOpen}
        autoHideDuration={4000}
        onClose={() => setErrorOpen(false)}
        anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
      >
        <Alert
          onClose={() => {
            setErrorOpen(false);
            setErrorMessage('');
          }}
          severity="error"
          variant="filled"
        >
          {errorMessage}
        </Alert>
      </Snackbar>

      {/* Header: Breadcrumbs + Save Status */}
      <Grid
        container
        justifyContent="space-between"
        gap={0.5}
        alignItems="center"
      >
        <Grid item xs={7.75}>
          <FormBreadcrumbs
            config={props.config}
            currentFormId={props.formId}
            navigateToRecordList={props.config.navigation.navigateToRecordList}
            navigationContext={props.navigationContext}
          />
        </Grid>
        <Grid item xs={3.75} paddingRight={1}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 0.5,
            }}
          >
            {isSaving || pendingValuesRef.current ? (
              <>
                <CircularProgress size={14} color="inherit" />
                <Typography variant="body2" color="text.secondary">
                  Saving...
                </Typography>
              </>
            ) : (
              <>
                <CheckIcon sx={{fontSize: 16, color: 'success.main'}} />
                <Typography variant="body2" color="text.secondary">
                  Saved
                </Typography>
              </>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Optional Heading Slot */}
      {props.headingSlot}

      {/* Navigation Buttons (Top) */}
      <NavigationButtonsDisplay buttons={navigationButtons} />

      {/* Form Progress */}
      <LiveFormProgress
        form={form as FaimsForm}
        formId={props.formId}
        uiSpec={dataEngine.uiSpec}
        visibilityMap={visibleMap}
      />

      {/* Main Form */}
      <FormManager
        key={props.recordId}
        form={form as FaimsForm}
        formName={props.formId}
        uiSpec={dataEngine.uiSpec}
        config={formManagerConfig}
        navigationContext={props.navigationContext}
        fieldVisibilityMap={visibleMap}
        debugMode={debugMode}
      />

      {/* Navigation Buttons (Bottom) */}
      <NavigationButtonsDisplay buttons={navigationButtons} />
    </Stack>
  );
};
