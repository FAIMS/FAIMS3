import {
  AvpUpdateMode,
  currentlyVisibleMap,
  FaimsAttachments,
  FormDataEntry,
  FormRelationshipInstance,
  HydratedRecord,
  HydratedRecordDocument,
} from '@faims3/data-model';
import {useForm} from '@tanstack/react-form';
import {useQuery} from '@tanstack/react-query';
import {debounce, DebouncedFunc} from 'lodash';
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {formDataExtractor} from '../../utils';
import {CompiledFormSchema, FormValidation} from '../../validationModule';
import {FaimsForm, FaimsFormData} from '../types';
import {FieldVisibilityMap, FormManager} from './FormManager';
import {FormBreadcrumbs} from './components/NavigationBreadcrumbs';
import {
  FormNavigationButtons,
  ImpliedParentNavInfo,
  ParentNavInfo,
} from './components/NavigationButtons';
import {
  getRecordContextFromRecord,
  onChangeTemplatedFields,
} from './templatedFields';
import {
  FormNavigationContext,
  FullFormConfig,
  FullFormManagerConfig,
} from './types';
import {getImpliedNavigationRelationships} from '../utils';

/**
 * The validation modes:
 *
 * FULL = all fields (which are conditionally visible) are validated
 * ONLY_TOUCHED = field validation is filtered based on if a field has been
 * touched
 */
export type ValidationMode = 'FULL' | 'ONLY_TOUCHED';

/**
 * Debounce time for form syncs to prevent excessive updates to the backend.
 * Changes are batched and saved after this delay (in milliseconds).
 */
const FORM_SYNC_DEBOUNCE_MS = 1000;

/**
 * Props for the EditableFormManager component.
 */
export interface EditableFormManagerProps extends ComponentProps<any> {
  /** The record ID being edited */
  recordId: string;
  /** The currently active user */
  activeUser: string;
  /** The initial data to load into the form */
  initialData?: FaimsFormData;
  /** The existing record - this helps build contextual infills */
  existingRecord: HydratedRecordDocument;
  /** The initial revision ID to work on (can change if we are updating in
   * parent mode) */
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
  /** Enable debug logging for save operations */
  debugMode?: boolean;
}

export interface EditableFormManagerHandle {
  // Force a save - this is useful for clients which need to ensure changes are
  // saved prior to navigation events at the browser/client specific level
  flushSave: () => Promise<void>;
  // A check to see if there are any pending changes (debounced onChange which
  // has not been handled yet)
  hasPendingChanges: () => boolean;
}

/**
 * EditableFormManager - Manages a full-featured editable form with backend
 * synchronization.
 *
 * This component handles:
 * - Loading form data from the data engine
 * - Creating new revisions when editing existing records (in 'parent' mode)
 * - Debounced auto-saving of form changes
 * - Attachment management (add/remove)
 * - Form submission and completion
 */
export const EditableFormManager = (props: EditableFormManagerProps) => {
  const {debugMode = false, onReady} = props;

  // Track whether any edits have been made (triggers revision creation in
  // parent mode)
  const [edited, setEdited] = useState(false);

  // The revision ID we're currently working with (may change after first edit
  // in parent mode)
  const [workingRevisionId, setWorkingRevisionId] = useState<string>(
    props.revisionId
  );

  // What kind of validation?
  const validationMode: ValidationMode =
    props.mode === 'new' ? 'ONLY_TOUCHED' : 'FULL';

  // Get the data engine instance
  const dataEngine = useMemo(() => {
    return props.config.dataEngine();
  }, [props.config.dataEngine]);

  // Visible field tracking - passed down to children
  const [visibleMap, setVisibleMap] = useState<FieldVisibilityMap | undefined>(
    currentlyVisibleMap({
      values: formDataExtractor({fullData: props.initialData ?? {}}),
      uiSpec: dataEngine.uiSpec,
      viewsetId: props.formId,
    })
  );

  // keep this up to date
  const validationSchema = useRef<CompiledFormSchema>(
    FormValidation.compileFormSchema({
      uiSpec: dataEngine.uiSpec,
      formId: props.formId,
      config: {visibleBehaviour: 'include'},
    })
  );

  // Track pending save state for flush functionality
  const pendingValuesRef = useRef<boolean>(false);
  const isSavingRef = useRef(false);

  // Determine information about parent context, if necessary
  const parentNavigationInformation = useQuery({
    queryKey: [props.navigationContext, props.recordId, props.revisionId],
    queryFn: async () => {
      // Root mode doesn't need any navigational information
      const getExplicitNav = async () => {
        if (props.navigationContext.mode === 'root') {
          return null;
        } else if (props.navigationContext.mode === 'child') {
          const lineage = props.navigationContext.lineage;
          if (lineage.length === 0) {
            // This shouldn't happen - but good to be careful
            return null;
          }
          // Latest entry is the head
          const latestLineage = lineage[lineage.length - 1];
          if (latestLineage === undefined) {
            // This shouldn't happen - but good to be careful
            return null;
          }
          // Determine various information about the parent record
          const engine = props.config.dataEngine();
          // Get hydrated parent record
          const hydrated = await engine.hydrated.getHydratedRecord({
            recordId: latestLineage.recordId,
            revisionId: latestLineage.revisionId,
          });
          // TODO: consider per revision navigation
          const link = props.config.navigation.getToRecordLink({
            recordId: latestLineage.recordId,
            mode: latestLineage.parentMode,
          });
          return {
            parentNavButton: {
              link,
              mode: latestLineage.parentMode,
              recordId: latestLineage.recordId,
              label: `Return to ${hydrated.hrid}`,
              fieldId: latestLineage.fieldId,
              formId: hydrated.record.formId,
              relationType: latestLineage.relationType,
            } satisfies ParentNavInfo,
            hydratedRecord: hydrated,
            fullContext: props.navigationContext,
          };
        }
        return null;
      };

      // This function looks at the relationship to see if we have implied
      // navigation - this is only used where explicit navigation is not
      // available
      const getImpliedNav = async () => {
        const engine = props.config.dataEngine();
        const hydrated = await engine.hydrated.getHydratedRecord({
          recordId: props.recordId,
          revisionId: props.revisionId,
        });

        return await getImpliedNavigationRelationships(
          hydrated.revision,
          engine,
          dataEngine.uiSpec
        );
      };

      const explicit = await getExplicitNav();
      const implied = await getImpliedNav();
      return {explicit, implied};
    },
    networkMode: 'always',
    refetchOnMount: true,
    gcTime: 0,
    staleTime: 0,
  });

  /**
   * Ensures we have a working revision ready for edits.
   *
   * In 'parent' mode, the first edit creates a new child revision to preserve
   * history. This implements the AVP (Attribute-Value-Pair) versioning strategy
   * where:
   * - The original revision remains unchanged (parent)
   * - A new revision is created as a child for edits
   * - Subsequent edits continue on the same child revision
   *
   * @returns The revision ID to use for updates, or null if unavailable
   */
  const ensureWorkingRevision = useCallback(async (): Promise<string> => {
    let relevantRevisionId = workingRevisionId;

    // Create new revision on first edit in parent mode
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

    // Mark as edited for non-parent modes or subsequent edits
    if (!edited) {
      setEdited(true);
    }

    // Either the current or newly created revision ID
    return relevantRevisionId;
  }, [
    edited,
    workingRevisionId,
    props.mode,
    props.recordId,
    props.activeUser,
    dataEngine,
  ]);

  /**
   * The actual save implementation - called by debounced handler.
   * Saves the provided values to the backend.
   */
  const performSave = useCallback(async () => {
    if (debugMode) {
      console.log('[EditableFormManager] performSave called', {
        timestamp: new Date().toISOString(),
        recordId: props.recordId,
        valueKeys: Object.keys(form.state.values ?? {}),
      });
    }

    isSavingRef.current = true;

    try {
      // Updating data
      const revisionToUpdate = await ensureWorkingRevision();

      if (debugMode) {
        console.log('[EditableFormManager] Got working revision', {
          revisionId: revisionToUpdate,
        });
      }

      // First, lets fire any updates to the templated fields
      onChangeTemplatedFields({
        // TODO: understand why this is upset
        form: form as FaimsForm,
        formId: props.formId,
        uiSpec: dataEngine.uiSpec,
        // Don't fire listeners again redundantly
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

      if (debugMode) {
        console.log('[EditableFormManager] Save completed successfully', {
          timestamp: new Date().toISOString(),
          revisionId: revisionToUpdate,
          newData: form.state.values,
        });
      }

      // Clear pending values since we've saved
      pendingValuesRef.current = false;
    } catch (error) {
      console.error('Failed to update revision:', error);
      if (debugMode) {
        console.error('[EditableFormManager] Save failed', {
          timestamp: new Date().toISOString(),
          error,
        });
      }
    } finally {
      isSavingRef.current = false;
    }

    // Updating visibility
    setVisibleMap(
      currentlyVisibleMap({
        values: formDataExtractor({fullData: form.state.values}),
        uiSpec: dataEngine.uiSpec,
        viewsetId: props.formId,
      })
    );
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

  // Use a ref to always have access to the latest performSave without
  // recreating debounce
  const performSaveRef = useRef(performSave);
  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  /**
   * Create debounced save function. We use useMemo to ensure it's stable
   * across renders, and store it in a ref so we can access it for flushing.
   */
  const debouncedSaveRef = useRef<DebouncedFunc<
    (values: FaimsFormData) => Promise<void>
  > | null>(null);

  // Created only once or when debug mode changes
  const debouncedSave = useMemo(() => {
    // Cancel any existing debounced function
    if (debouncedSaveRef.current) {
      if (debugMode) {
        console.log('[EditableFormManager] Recreating debounced function');
      }
      debouncedSaveRef.current.cancel();
    }

    const debouncedFn = debounce(async () => {
      if (debugMode) {
        console.log('[EditableFormManager] Debounced save executing', {
          timestamp: new Date().toISOString(),
        });
      }
      // Call via ref so we always get the latest implementation
      await performSaveRef.current();
    }, FORM_SYNC_DEBOUNCE_MS);

    debouncedSaveRef.current = debouncedFn;
    return debouncedFn;
  }, [debugMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debugMode) {
        console.log('[EditableFormManager] Unmounting, cancelling debounce');
      }
      debouncedSave.cancel();
    };
  }, [debouncedSave, debugMode]);

  /**
   * Handler called when form values change. Tracks pending values and
   * triggers debounced save.
   */
  const onChange = useCallback(() => {
    if (debugMode) {
      console.log('[EditableFormManager] onChange triggered', {
        timestamp: new Date().toISOString(),
        hasPendingValues: pendingValuesRef.current,
        isSaving: isSavingRef.current,
      });
    }

    // Track that we have pending unsaved changes
    pendingValuesRef.current = true;

    // Trigger debounced save
    debouncedSave();
  }, [debouncedSave, debugMode]);

  /**
   * Immediately flush any pending saves. This should be called before
   * navigation to ensure all changes are persisted.
   *
   * @returns Promise that resolves when save is complete
   */
  const flushSave = useCallback(async (): Promise<void> => {
    if (debugMode) {
      console.log('[EditableFormManager] flushSave called', {
        timestamp: new Date().toISOString(),
        hasPendingValues: pendingValuesRef.current,
        isSaving: isSavingRef.current,
      });
    }

    // Cancel the debounced call - we'll save directly
    debouncedSave.cancel();

    // If there are pending values, save them immediately
    if (pendingValuesRef.current) {
      if (debugMode) {
        console.log('[EditableFormManager] Flushing pending values');
      }
      // Use the ref here too for consistency
      await performSaveRef.current();
    }

    // Wait for any in-flight save to complete
    while (isSavingRef.current) {
      if (debugMode) {
        console.log('[EditableFormManager] Waiting for in-flight save...');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (debugMode) {
      console.log('[EditableFormManager] flushSave complete');
    }
  }, [debouncedSave, debugMode]);

  /**
   * Check if there are unsaved changes pending.
   */
  const hasPendingChanges = useCallback((): boolean => {
    return pendingValuesRef.current || isSavingRef.current;
  }, []);

  const validationFunction = useCallback(
    (value: FaimsFormData) => {
      // Pull out raw data
      const data = formDataExtractor({fullData: value});

      // Get the latest version of the validation schema (only recompiles
      // the necessary parts)
      validationSchema.current = FormValidation.recompileFormSchema({
        existingSchema: validationSchema.current,
        formId: props.formId,
        uiSpec: dataEngine.uiSpec,
        data,
        config: {visibleBehaviour: 'ignore'},
      });

      // Build the final schema
      let schema = validationSchema.current.schema;

      // If validation mode is only touched, then we need to filter
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

      // Run a safe parse with zod
      const res = schema.safeParse(data);

      // If the parse did not succeed, format errors into the preferred
      // TanStack error format.
      if (!res.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of res.error.issues) {
          const fieldPath = issue.path.join('.');
          // Only keep first error per field
          if (!fieldErrors[fieldPath]) {
            fieldErrors[fieldPath] = issue.message;
          }
        }
        return {fields: fieldErrors};
      }
    },
    [validationMode, props.formId, dataEngine.uiSpec]
  );

  // Notify parent when ready and when handle changes
  useEffect(() => {
    onReady?.({
      flushSave,
      hasPendingChanges,
    });
  }, [onReady, flushSave, hasPendingChanges]);

  // Initialize TanStack Form with loaded data and change handlers
  const form = useForm({
    defaultValues: props.initialData,
    listeners: {
      // Use our own onChange handler (no debounce here - we manage it
      // ourselves)
      onChange,
    },
    validators: {
      onMount: ({value}) => {
        return validationFunction(value);
      },
      onChange: ({value}) => {
        // There is no synchronous debounce available at the moment - we may
        // need to monitor this for performance. If we put this in the async on
        // change with debounce we get error flickering.
        return validationFunction(value);
      },
    },
  });

  /**
   * Handles adding a new attachment (photo/file) to a field.
   *
   * Process:
   * 1. Ensure we have a working revision (creates one if needed)
   * 2. Store the blob in the attachment service with metadata
   * 3. Add attachment reference to the beginning of the field's attachment list
   * 4. Update form state and trigger save
   *
   * @param fieldId - The field to add the attachment to
   * @param blob - The file data as a Blob
   * @param contentType - MIME type of the file (e.g., 'image/jpeg')
   */
  const handleAddAttachment = useCallback(
    async ({
      fieldId,
      blob,
      contentType,
      type,
      fileFormat,
    }: {
      fieldId: string;
      blob: Blob;
      contentType: string;
      type: 'photo' | 'file';
      fileFormat: string;
    }) => {
      // Ensure we have a revision to attach to
      const revisionToUse = await ensureWorkingRevision();

      if (!revisionToUse) {
        throw new Error('No working revision available for attachment');
      }

      // Generate unique filename with timestamp
      const timestamp = new Date().toISOString();
      const filename = `${
        type === 'photo' ? 'photo' : 'file'
      }_${timestamp}.${fileFormat}`;

      // Store attachment in the attachment service
      const attachmentResult = await props.config
        .attachmentEngine()
        .storeAttachmentFromBlob({
          blob,
          metadata: {
            attachmentDetails: {
              filename,
              contentType,
            },
            recordContext: {
              recordId: props.recordId,
              revisionId: revisionToUse,
              created: timestamp,
              createdBy: props.activeUser,
            },
          },
        });

      // Get current field state
      const state = form.state.values[fieldId];

      // Add new attachment to the beginning of the list
      const newAttachments: FaimsAttachments = [
        {
          attachmentId: attachmentResult.identifier.id,
          filename: attachmentResult.metadata.filename,
          fileType: attachmentResult.metadata.contentType,
        },
        ...(state?.attachments ?? []),
      ];

      // Create updated field value
      const newValue: FormDataEntry = {
        ...(state || {}),
        attachments: newAttachments,
      };

      // Update form and trigger save
      form.setFieldValue(fieldId, newValue);

      // Return attachment ID
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

  /**
   * Handles removing an attachment from a field.
   *
   * Process:
   * 1. Ensure we have a working revision
   * 2. Filter out the attachment with the given ID
   * 3. Update form state and trigger save
   *
   * Note: This only removes the reference from the field - the actual attachment
   * file remains in storage for historical/audit purposes.
   *
   * @param fieldId - The field to remove the attachment from
   * @param attachmentId - The ID of the attachment to remove
   */
  const handleRemoveAttachment = useCallback(
    async ({
      fieldId,
      attachmentId,
    }: {
      fieldId: string;
      attachmentId: string;
    }) => {
      // Ensure we have a revision to modify
      const revisionToUse = await ensureWorkingRevision();

      if (!revisionToUse) {
        throw new Error('No working revision available for attachment removal');
      }

      // Get current field state
      const state = form.state.values[fieldId];

      if (!state?.attachments) {
        console.warn('No attachments found in field');
        return;
      }

      // Filter out the attachment to remove
      const newAttachments: FaimsAttachments = state.attachments.filter(
        attachment => attachment.attachmentId !== attachmentId
      );

      // Create updated field value
      const newValue: FormDataEntry = {
        ...(state || {}),
        attachments: newAttachments,
      };

      // Update form and trigger save
      form.setFieldValue(fieldId, newValue);
    },
    [ensureWorkingRevision, form]
  );

  // Combine base config with attachment handlers for field components
  const formManagerConfig: FullFormManagerConfig = {
    ...props.config,
    navigationContext: props.navigationContext,
    attachmentHandlers: {
      addAttachment: handleAddAttachment,
      removeAttachment: handleRemoveAttachment,
    },
    trigger: {
      commit: async () => {
        // Immediately save without debounce - used by fields that redirect
        await flushSave();
      },
    },
  };

  const impliedParents = useMemo(() => {
    // Wait until data loaded
    if (!parentNavigationInformation.data) {
      return undefined;
    }
    const explicit = parentNavigationInformation.data.explicit;
    const implied = parentNavigationInformation.data.implied;
    // If we have real lineage, then don't include implied parents
    if ((explicit?.fullContext.lineage.length ?? 0) > 0) {
      return undefined;
    }
    // Look for implied parents
    if (implied && implied.length > 0) {
      return implied.map(
        entry =>
          ({
            label: `View ${entry.hrid}`,
            recordId: entry.recordId,
            onNavigate() {
              props.config.navigation.navigateToViewRecord({
                recordId: entry.recordId,
              });
            },
            formId: entry.formId,
            fieldId: entry.fieldId,
            type: entry.type,
          } satisfies ImpliedParentNavInfo)
      );
    }
    // Otherwise
    return undefined;
  }, [parentNavigationInformation.data]);

  // Memoised navigation buttons - used twice (top and bottom) - hooks into
  // pending flush changes to ensure that no data loss occurs during navigation
  // due to pending debounce
  const navigationButtons = useMemo(() => {
    const info = parentNavigationInformation.data?.explicit;

    const parentFormLabel = info
      ? dataEngine.uiSpec.viewsets[info.parentNavButton.formId]?.label
      : undefined;

    return (
      <FormNavigationButtons
        parentNavInfo={info?.parentNavButton}
        parentFormLabel={parentFormLabel}
        navigateToRecordList={formManagerConfig.navigation.navigateToRecordList}
        onNavigateToParent={
          info ? params => props.config.navigation.toRecord(params) : undefined
        }
        flushSave={flushSave}
        hasPendingChanges={hasPendingChanges}
        onNavigateToViewRecord={() => {
          props.config.navigation.navigateToViewRecord({
            recordId: props.recordId,
          });
        }}
        impliedParentNavInfo={impliedParents}
      />
    );
  }, [
    parentNavigationInformation.data,
    formManagerConfig.navigation,
    dataEngine.uiSpec,
    props.config.navigation,
    flushSave,
    hasPendingChanges,
  ]);

  return (
    <>
      {
        // Breadcrumbs
      }
      <FormBreadcrumbs
        config={props.config}
        currentFormId={props.formId}
        navigateToRecordList={props.config.navigation.navigateToRecordList}
        navigationContext={props.navigationContext}
      />
      {
        // Action buttons (top)
      }
      {navigationButtons}

      {/* Main form component */}
      <FormManager
        // Force complete remount if record ID changes
        key={props.recordId}
        // TODO: understand why this is upset
        form={form as FaimsForm}
        formName={props.formId}
        uiSpec={dataEngine.uiSpec}
        config={formManagerConfig}
        navigationContext={props.navigationContext}
        fieldVisibilityMap={visibleMap}
        debugMode={debugMode}
      />
      {
        // Action buttons (repeated at bottom for usability)
      }
      {navigationButtons}
    </>
  );
};
