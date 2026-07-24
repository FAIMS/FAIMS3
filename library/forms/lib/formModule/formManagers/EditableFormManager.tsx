import {
  AvpUpdateMode,
  attachmentSaveTrace,
  currentlyVisibleMap,
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
import {ConfirmDialog} from '../../components/ConfirmDialog';
import {useForm} from '@tanstack/react-form';
import {debounce, DebouncedFunc} from 'lodash';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {logError, logInfo, logWarn} from '../../logging';
import {formDataExtractor} from '../../utils';
import {completion, getFieldId} from '../utils';
import {CompiledFormSchema, FormValidation} from '../../validationModule';
import {FaimsForm, FaimsFormData} from '../types';
import {LiveFormProgress} from './components/FormProgress';
import {FormManager} from './FormManager';
import {
  NavigationButtonsDisplay,
  useNavigationDataPreparation,
  useNavigationLogic,
} from './navigation';
import {FormBreadcrumbs} from './navigation/NavigationBreadcrumbs';
import {
  getRecordContextFromRecord,
  onChangeTemplatedFields,
} from './templatedFields';
import {onChangeComputedFields} from './computedFields';
import {
  FieldVisibilityMap,
  FormNavigationContext,
  FullFormConfig,
  FullFormManagerConfig,
} from './types';
import {initializeAutoIncrementFields} from './utils/autoIncrementInitializer';

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
  /** True while any attachment is in-memory and being stored to PouchDB */
  isAttachmentSaving: () => boolean;
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
  /** Drives save-status UI; refs alone do not trigger re-renders. */
  const [hasPendingSave, setHasPendingSave] = useState(false);

  // ---------------------------------------------------------------------------
  // Revision Management
  // ---------------------------------------------------------------------------
  const ensureWorkingRevision = useCallback(async (): Promise<string> => {
    attachmentSaveTrace('ensureWorkingRevision:start', {
      edited,
      workingRevisionId,
      mode: props.mode,
      recordId: props.recordId,
    });
    let relevantRevisionId = workingRevisionId;

    if (!edited && props.mode === 'parent') {
      try {
        attachmentSaveTrace('ensureWorkingRevision:before-createRevision', {
          recordId: props.recordId,
          revisionId: workingRevisionId,
        });
        const newRevision = await dataEngine.form.createRevision({
          recordId: props.recordId,
          revisionId: workingRevisionId,
          createdBy: props.activeUser,
        });
        setWorkingRevisionId(newRevision._id);
        relevantRevisionId = newRevision._id;
        attachmentSaveTrace('ensureWorkingRevision:after-createRevision', {
          newRevisionId: newRevision._id,
        });
      } catch (error) {
        attachmentSaveTrace('ensureWorkingRevision:createRevision-error', {
          error: String(error),
        });
        logError(new Error('Failed to create revision:'), {error});
        throw error;
      }
    }

    if (!edited) {
      setEdited(true);
    }

    attachmentSaveTrace('ensureWorkingRevision:complete', {
      revisionId: relevantRevisionId,
    });
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
    attachmentSaveTrace('performSave:start', {
      pendingValues: pendingValuesRef.current,
      isSaving: isSavingRef.current,
    });
    if (debugMode) {
      logInfo('[EditableFormManager] performSave called');
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const revisionToUpdate = await ensureWorkingRevision();

      onChangeComputedFields({
        form: form as FaimsForm,
        formId: props.formId,
        uiSpec: dataEngine.uiSpec,
        runListeners: false,
      });
      onChangeTemplatedFields({
        form: form as FaimsForm,
        formId: props.formId,
        uiSpec: dataEngine.uiSpec,
        runListeners: false,
        context: getRecordContextFromRecord({record: props.existingRecord}),
      });

      attachmentSaveTrace('performSave:before-updateRevision', {
        revisionId: revisionToUpdate,
        recordId: props.recordId,
      });
      await dataEngine.form.updateRevision({
        revisionId: revisionToUpdate,
        recordId: props.recordId,
        updatedBy: props.activeUser,
        update: form.state.values ?? {},
        mode: props.mode,
      });

      pendingValuesRef.current = false;
      setHasPendingSave(false);
      attachmentSaveTrace('performSave:complete', {
        revisionId: revisionToUpdate,
      });
    } catch (error) {
      attachmentSaveTrace('performSave:error', {error: String(error)});
      logError(new Error('Failed to update revision:'), {error});
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      attachmentSaveTrace('performSave:finally', {
        pendingValues: pendingValuesRef.current,
      });
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
    setHasPendingSave(true);
    debouncedUpdateVisibility();
    debouncedSave();
  }, [debouncedSave, debouncedUpdateVisibility]);

  // ---------------------------------------------------------------------------
  // Flush Save
  // ---------------------------------------------------------------------------
  const flushSave = useCallback(async (): Promise<void> => {
    attachmentSaveTrace('flushSave:start', {
      pendingValues: pendingValuesRef.current,
      isSaving: isSavingRef.current,
    });
    if (debugMode) {
      logInfo('[EditableFormManager] flushSave called');
    }

    debouncedSave.cancel();

    if (pendingValuesRef.current) {
      attachmentSaveTrace('flushSave:awaiting-performSave');
      await performSaveRef.current();
    }

    // Poll the saving ref
    let waitIterations = 0;
    while (isSavingRef.current) {
      waitIterations += 1;
      if (waitIterations === 1 || waitIterations % 20 === 0) {
        attachmentSaveTrace('flushSave:waiting-for-isSavingRef', {
          waitIterations,
        });
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    attachmentSaveTrace('flushSave:complete', {waitIterations});
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
          if (meta && meta.isTouched) {
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
  // Attachment saving state (blocks section navigation until photo/file is in PouchDB)
  // Tracks counts per fieldId so multiple parallel saves are handled correctly.
  // ---------------------------------------------------------------------------
  const [attachmentSavingCounts, setAttachmentSavingCounts] = useState<
    Map<string, number>
  >(new Map());

  const setAttachmentSaving = useCallback(
    (fieldId: string, saving: boolean) => {
      setAttachmentSavingCounts(prev => {
        const next = new Map(prev);
        const current = next.get(fieldId) ?? 0;
        const updated = saving ? current + 1 : Math.max(0, current - 1);

        if (updated > 0) {
          next.set(fieldId, updated);
        } else {
          next.delete(fieldId);
        }

        attachmentSaveTrace('setAttachmentSaving', {
          fieldId,
          saving,
          previousCount: current,
          updatedCount: updated,
          activeFields: [...next.keys()],
        });

        return next;
      });
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Expose Handle to Parent
  // ---------------------------------------------------------------------------
  useEffect(() => {
    onReady?.({
      flushSave,
      hasPendingChanges,
      isAttachmentSaving: () => attachmentSavingCounts.size > 0,
    });
  }, [onReady, flushSave, hasPendingChanges, attachmentSavingCounts.size]);

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

      attachmentSaveTrace('handleAddAttachment:start', {
        fieldId,
        type,
        fileFormat,
        contentType,
        hasBlob: Boolean(blob),
        blobSize: blob?.size,
        hasBase64: Boolean(base64),
        base64Length: base64?.length,
      });

      const revisionToUse = await ensureWorkingRevision();
      if (!revisionToUse) {
        throw new Error('No working revision available for attachment');
      }

      attachmentSaveTrace('handleAddAttachment:revision-ready', {
        fieldId,
        revisionId: revisionToUse,
      });

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
        attachmentSaveTrace('handleAddAttachment:before-storeBase64', {
          fieldId,
        });
        attachmentResult = await props.config
          .attachmentEngine()
          .storeAttachmentFromBase64({base64, metadata});
        attachmentSaveTrace('handleAddAttachment:after-storeBase64', {
          fieldId,
          attachmentId: attachmentResult.identifier.id,
        });
      } else if (blob) {
        attachmentSaveTrace('handleAddAttachment:before-storeBlob', {
          fieldId,
        });
        attachmentResult = await props.config
          .attachmentEngine()
          .storeAttachmentFromBlob({blob, metadata});
        attachmentSaveTrace('handleAddAttachment:after-storeBlob', {
          fieldId,
          attachmentId: attachmentResult.identifier.id,
        });
      } else {
        throw new Error('Either blob or base64 data must be provided');
      }

      const attachmentId = attachmentResult.identifier.id;

      attachmentSaveTrace('handleAddAttachment:before-setFieldValue', {
        fieldId,
        attachmentId,
      });
      // Attachments metadata only — fields own how the id is written into `data`.
      form.setFieldValue(fieldId, (prev: FormDataEntry | undefined) => {
        const state = prev ?? {};
        return {
          ...state,
          attachments: [
            {
              attachmentId,
              filename: attachmentResult.metadata.filename,
              fileType: attachmentResult.metadata.contentType,
            },
            ...(state.attachments ?? []),
          ],
        };
      });
      attachmentSaveTrace('handleAddAttachment:complete', {
        fieldId,
        attachmentId,
      });
      return attachmentId;
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

      form.setFieldValue(fieldId, (prev: FormDataEntry | undefined) => {
        const state = prev ?? {};
        if (!state.attachments) {
          return state;
        }
        return {
          ...state,
          attachments: state.attachments.filter(
            attachment => attachment.attachmentId !== attachmentId
          ),
        };
      });
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
    hasPendingSave,
    isFormSaving: isSaving,
    impliedParents: navigationData.impliedParents,
    createAnotherChild: navigationData.createAnotherChild,
  });

  // ---------------------------------------------------------------------------
  // Warn the user before finishing if required fields or errors remain.
  // ---------------------------------------------------------------------------
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const pendingFinishRef = useRef<null | (() => void | Promise<void>)>(null);
  const firstIssueFieldRef = useRef<string | null>(null);
  // Prevents a double-click from running the guard twice while flushSave is awaiting.
  const guardInFlightRef = useRef(false);
  const [issueCount, setIssueCount] = useState(0);

  const formLabel = useMemo(
    () =>
      getFormLabel({uiSpec: dataEngine.uiSpec, formId: props.formId}) ||
      'record',
    [dataEngine.uiSpec, props.formId]
  );

  // Scroll to the first field that still has an issue.
  const scrollToFirstIssue = useCallback(() => {
    const name = firstIssueFieldRef.current;
    if (!name) return;
    const el = document.getElementById(getFieldId({fieldId: name}));
    el?.scrollIntoView({behavior: 'smooth', block: 'center'});
  }, []);

  // ---------------------------------------------------------------------------
  // Attachment saving lock (prevent navigation until attachment in PouchDB)
  // ---------------------------------------------------------------------------
  const isAttachmentSaving = attachmentSavingCounts.size > 0;

  // On Finish: flush pending saves, then check for unresolved issues.
  // If nothing's outstanding, finish straight away; otherwise open the dialog.
  const guardFinish = useCallback(
    (onClick: () => void | Promise<void>) => async () => {
      if (guardInFlightRef.current) return;
      guardInFlightRef.current = true;
      try {
        try {
          await flushSave();
        } catch (err) {
          // Best-effort flush — in-memory state is still good enough to check against.
          logWarn('[guardFinish] flushSave failed before issue check', {err});
        }

        const progress = completion({
          uiSpec: dataEngine.uiSpec,
          formId: props.formId,
          data: form.state.values ?? {},
          visibilityMap: visibleMap,
        });

        const problematic = new Set<string>(progress.incompleteRequired);
        for (const [name, meta] of Object.entries(form.state.fieldMeta ?? {})) {
          if ((meta?.errors as unknown[] | undefined)?.length) {
            problematic.add(name);
          }
        }

        if (problematic.size === 0) {
          await onClick();
          return;
        }

        const [firstField] = problematic;
        setIssueCount(problematic.size);
        firstIssueFieldRef.current = firstField ?? null;
        pendingFinishRef.current = onClick;
        setConfirmFinishOpen(true);
      } finally {
        guardInFlightRef.current = false;
      }
    },
    [flushSave, dataEngine.uiSpec, props.formId, form, visibleMap]
  );

  // Lock nav buttons while an attachment saves; finish buttons go via guardFinish.
  const navigationButtonsWithAttachmentLock = useMemo(() => {
    return navigationButtons.map(b => {
      const base = isAttachmentSaving
        ? {
            ...b,
            disabled: true,
            loading: true,
            statusText: 'saving attachment…',
          }
        : b;
      return b.requiresFinishGuard
        ? {...base, onClick: guardFinish(b.onClick)}
        : base;
    });
  }, [navigationButtons, isAttachmentSaving, guardFinish]);

  const onCompleteHandlerWithAttachmentLock = useMemo(() => {
    if (isAttachmentSaving) {
      return {
        ...onCompleteHandler,
        onClick: async () => {
          // no-op: completion is blocked until attachment stored
        },
      };
    }
    return {
      ...onCompleteHandler,
      onClick: guardFinish(onCompleteHandler.onClick),
    };
  }, [onCompleteHandler, isAttachmentSaving, guardFinish]);

  // ---------------------------------------------------------------------------
  // Form Manager Config
  // ---------------------------------------------------------------------------
  const formManagerConfig: FullFormManagerConfig = useMemo(
    () => ({
      ...props.config,
      onCompleteHandler: onCompleteHandlerWithAttachmentLock,
      navigationContext: props.navigationContext,
      attachmentHandlers: {
        addAttachment: handleAddAttachment,
        removeAttachment: handleRemoveAttachment,
        setAttachmentSaving,
      },
      attachmentSaving: {
        isSaving: () => attachmentSavingCounts.size > 0,
      },
      trigger: {
        commit: flushSave,
      },
    }),
    [
      onCompleteHandlerWithAttachmentLock,
      props.config,
      props.navigationContext,
      handleAddAttachment,
      handleRemoveAttachment,
      setAttachmentSaving,
      attachmentSavingCounts.size,
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
    <Stack sx={{gap: 1.5}}>
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
        sx={{justifyContent: 'space-between', gap: 0.5, alignItems: 'center'}}
      >
        <Grid size={7.75}>
          <FormBreadcrumbs
            config={props.config}
            currentFormId={props.formId}
            navigateToRecordList={props.config.navigation.navigateToRecordList}
            navigationContext={props.navigationContext}
          />
        </Grid>
        <Grid size={3.75} sx={{paddingRight: 1}}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 0.5,
            }}
          >
            {isSaving || hasPendingSave ? (
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
      <NavigationButtonsDisplay
        buttons={navigationButtonsWithAttachmentLock}
        marginBottom={0.5}
      />

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
      <NavigationButtonsDisplay
        buttons={navigationButtonsWithAttachmentLock}
        marginBottom={0.5}
      />

      {/* Warning dialog when Finish is pressed with issues still open. */}
      <ConfirmDialog
        open={confirmFinishOpen}
        onClose={() => {
          // "Go back and review" — close + scroll the form to the first issue.
          pendingFinishRef.current = null;
          setConfirmFinishOpen(false);
          // Wait a tick so the dialog has unmounted before scrolling.
          setTimeout(scrollToFirstIssue, 0);
        }}
        onConfirm={async () => {
          setConfirmFinishOpen(false);
          const fn = pendingFinishRef.current;
          pendingFinishRef.current = null;
          if (fn) await fn();
        }}
        title={`Are you sure you want to finish ${formLabel}?`}
        cancelLabel="Go back and review"
        confirmLabel="Finish anyway"
      >
        <Typography
          variant="body2"
          onClick={() => {
            pendingFinishRef.current = null;
            setConfirmFinishOpen(false);
            setTimeout(scrollToFirstIssue, 0);
          }}
          sx={{
            cursor: 'pointer',
            textDecoration: 'underline',
            color: 'text.primary',
          }}
        >
          <strong>{issueCount}</strong> field{issueCount === 1 ? '' : 's'} still{' '}
          {issueCount === 1 ? 'has' : 'have'} errors.
        </Typography>
      </ConfirmDialog>
    </Stack>
  );
};
