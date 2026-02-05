import {
  AvpUpdateMode,
  FormRelationship,
  getFieldLabel,
  getFormLabel,
  getViewsetForField,
  UISpecification,
} from '@faims3/data-model';
import {useQuery, UseQueryResult} from '@tanstack/react-query';
import {useMemo} from 'react';
import {
  RelatedFieldValue,
  relatedFieldValueSchema,
  relatedRecordPropsSchema,
} from '../../../fieldRegistry/fields/RelatedRecord/types';
import {relationTypeToPair} from '../../../fieldRegistry/fields/RelatedRecord/utils';
import {getImpliedNavigationRelationships} from '../../utils';
import {FormNavigationContext, FullFormConfig} from '../types';
import {
  CreateAnotherChildConfig,
  ExplicitParentNavInfo,
  ImpliedParentNavInfo,
  NavigationType,
} from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for the useNavigationDataPreparation hook.
 */
export interface UseNavigationDataPreparationParams {
  /** Current record ID */
  recordId: string;
  /** Current revision ID */
  revisionId: string;
  /** Current form ID */
  formId: string;
  /** The active user performing edits */
  activeUser: string;
  /** The update mode (new, parent, etc.) */
  mode: AvpUpdateMode;
  /** Navigation context from parent */
  navigationContext: FormNavigationContext;
  /** Full form configuration with data engine access */
  config: FullFormConfig;
  /** UI specification for the notebook */
  uiSpec: UISpecification;
  /** Handler for errors */
  onError: (message: string) => void;
  /** Function to flush pending saves */
  flushSave: () => Promise<void>;
}

/**
 * Result from the useNavigationDataPreparation hook.
 */
export interface UseNavigationDataPreparationResult {
  /** The computed navigation type */
  navigationType: NavigationType;
  /** Explicit parent info from navigation history */
  explicitParentInfo: ExplicitParentNavInfo | null;
  /** Label for the parent form */
  parentFormLabel: string | undefined;
  /** Implied parents from relationship fields */
  impliedParents: ImpliedParentNavInfo[] | undefined;
  /** Configuration for creating another child */
  createAnotherChild: CreateAnotherChildConfig | undefined;
  /** Whether navigation data is still loading */
  isLoading: boolean;
  /** The underlying query for advanced use cases */
  query: UseQueryResult<NavigationQueryData, Error>;
}

interface NavigationQueryData {
  explicit: ExplicitNavigationData | null;
  implied: ImpliedNavigationEntry[] | null;
}

interface ExplicitNavigationData {
  parentNavButton: ExplicitParentNavInfo;
  fullContext: FormNavigationContext;
}

interface ImpliedNavigationEntry {
  hrid: string;
  recordId: string;
  formId: string;
  fieldId: string;
  type: 'parent' | 'linked';
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useNavigationDataPreparation - Prepares navigation data from form context.
 *
 * This hook extracts the complex data preparation logic that was previously
 * embedded in EditableFormManager. It queries for parent navigation information
 * and computes the various navigation options available.
 *
 * ## Responsibilities:
 * - Query for explicit parent navigation info from lineage
 * - Query for implied parents from relationship fields
 * - Compute create-another-child configuration
 * - Determine navigation type (parent vs child)
 *
 * ## Usage:
 * This hook is typically called once in EditableFormManager and its results
 * are passed to useNavigationLogic.
 */
export function useNavigationDataPreparation({
  recordId,
  revisionId,
  formId,
  activeUser,
  mode,
  navigationContext,
  config,
  uiSpec,
  onError,
  flushSave,
}: UseNavigationDataPreparationParams): UseNavigationDataPreparationResult {
  const dataEngine = useMemo(() => config.dataEngine(), [config]);

  // ---------------------------------------------------------------------------
  // Query for navigation information
  // ---------------------------------------------------------------------------
  const query = useQuery<NavigationQueryData, Error>({
    queryKey: ['navigation-info', navigationContext, recordId, revisionId],
    queryFn: async (): Promise<NavigationQueryData> => {
      // Query explicit navigation from lineage
      const explicit = await getExplicitNavigation({
        navigationContext,
        config,
        dataEngine,
      });

      // Query implied navigation from relationships
      const implied = await getImpliedNavigation({
        recordId,
        revisionId,
        dataEngine,
        uiSpec,
      });

      return {explicit, implied};
    },
    networkMode: 'always',
    refetchOnMount: true,
    gcTime: 0,
    staleTime: 0,
  });

  // ---------------------------------------------------------------------------
  // Compute navigation type
  // ---------------------------------------------------------------------------
  const navigationType = useMemo((): NavigationType => {
    const explicit = query.data?.explicit;
    if (
      explicit &&
      explicit.fullContext.mode === 'child' &&
      (explicit.fullContext.lineage.length ?? 0) > 0
    ) {
      return 'child';
    }
    return 'parent';
  }, [query.data]);

  // ---------------------------------------------------------------------------
  // Extract explicit parent info
  // ---------------------------------------------------------------------------
  const explicitParentInfo = useMemo((): ExplicitParentNavInfo | null => {
    return query.data?.explicit?.parentNavButton ?? null;
  }, [query.data]);

  // ---------------------------------------------------------------------------
  // Compute parent form label
  // ---------------------------------------------------------------------------
  const parentFormLabel = useMemo((): string | undefined => {
    const info = query.data?.explicit;
    if (!info) return undefined;
    return uiSpec.viewsets[info.parentNavButton.formId]?.label;
  }, [query.data, uiSpec]);

  // ---------------------------------------------------------------------------
  // Compute implied parents
  // ---------------------------------------------------------------------------
  const impliedParents = useMemo((): ImpliedParentNavInfo[] | undefined => {
    // Don't show implied parents if we have explicit lineage
    const explicit = query.data?.explicit;
    if (
      explicit &&
      explicit.fullContext.mode === 'child' &&
      (explicit.fullContext.lineage.length ?? 0) > 0
    ) {
      return undefined;
    }

    const implied = query.data?.implied;
    if (!implied || implied.length === 0) {
      return undefined;
    }

    return implied.map(entry => ({
      label: `View ${entry.hrid}`,
      recordId: entry.recordId,
      fieldId: entry.fieldId,
      formId: entry.formId,
      type: entry.type,
      onNavigate: () => {
        config.navigation.toRecord({
          recordId: entry.recordId,
          mode: mode,
        });
      },
    }));
  }, [query.data, mode, config.navigation]);

  // ---------------------------------------------------------------------------
  // Compute create another child configuration
  // ---------------------------------------------------------------------------
  const createAnotherChild = useMemo(():
    | CreateAnotherChildConfig
    | undefined => {
    const info = query.data?.explicit;
    if (
      !info ||
      info.fullContext.mode !== 'child' ||
      info.fullContext.lineage.length === 0
    ) {
      return undefined;
    }

    // Get the head element of the lineage
    const head = info.fullContext.lineage[info.fullContext.lineage.length - 1];
    if (!head || head.explorationType !== 'created-new-child') {
      return undefined;
    }

    // Parse field spec to check if button should be hidden
    const fieldSpec = uiSpec.fields[head.fieldId]?.['component-parameters'];
    const {data: fieldSpecData, error: fieldSpecError} =
      relatedRecordPropsSchema.safeParse(fieldSpec);

    if (!fieldSpecData) {
      console.error(
        'Failed to parse related record field parameters for field:',
        head.fieldId,
        fieldSpecError
      );
      return undefined;
    }

    if (fieldSpecData.hideCreateAnotherButton) {
      return undefined;
    }

    // Compute labels
    const fieldLabel = getFieldLabel(uiSpec, head.fieldId);
    const formLabel = getFormLabel({uiSpec, formId});
    const parentViewsetId = getViewsetForField(uiSpec, head.fieldId);
    const parentFormLabel = parentViewsetId
      ? getFormLabel({uiSpec, formId: parentViewsetId})
      : 'Unknown';

    // Create the onCreate handler
    const onCreate = async () => {
      try {
        // Get parent form data
        const parentFormData = await dataEngine.form.getExistingFormData({
          recordId: head.recordId,
          revisionId: head.revisionId,
        });

        // Get the related field value
        const relevantFieldValue = parentFormData.data[head.fieldId]?.data;
        const {success, error} =
          relatedFieldValueSchema.safeParse(relevantFieldValue);

        if (!success) {
          onError(
            'Failed to parse related field data. Try refreshing the app or contact a system administrator.'
          );
          console.error('Failed to parse related field value:', error);
          return;
        }

        // Build the relationship for the new child
        const relationType =
          head.relationType === 'parent'
            ? 'faims-core::Child'
            : 'faims-core::Linked';

        const relation = {
          fieldId: head.fieldId,
          recordId: head.recordId,
          relationTypeVocabPair: relationTypeToPair(relationType),
        };

        let relationship: FormRelationship;
        if (head.relationType === 'parent') {
          relationship = {parent: [relation]};
        } else {
          relationship = {linked: [relation]};
        }

        // Create the new sibling record
        const res = await dataEngine.form.createRecord({
          createdBy: config.user,
          formId: formId,
          relationship,
        });

        // Update parent's field value to include new child
        const normalizedRelationships = !relevantFieldValue
          ? []
          : Array.isArray(relevantFieldValue)
            ? relevantFieldValue
            : [relevantFieldValue];

        parentFormData.data[head.fieldId].data = [
          ...normalizedRelationships,
          {
            record_id: res.record._id,
            relation_type_vocabPair: relationTypeToPair(relationType),
          },
        ] satisfies RelatedFieldValue;

        // Update parent revision
        await dataEngine.form.updateRevision({
          revisionId: parentFormData.revisionId,
          mode: head.parentMode,
          recordId: parentFormData.context.record._id,
          update: parentFormData.data,
          updatedBy: activeUser,
        });

        // Flush current form before navigating
        await flushSave();

        // Navigate to the new record
        config.navigation.toRecord({
          recordId: res.record._id,
          mode: 'new',
        });
      } catch (error) {
        console.error('Failed to create another child:', error);
        onError('Failed to create another record. Please try again.');
      }
    };

    return {
      fieldLabel,
      formLabel,
      parentFormLabel,
      relationType: head.relationType,
      onCreate,
    };
  }, [
    query.data,
    uiSpec,
    formId,
    dataEngine,
    activeUser,
    config,
    flushSave,
    onError,
  ]);

  return {
    navigationType,
    explicitParentInfo,
    parentFormLabel,
    impliedParents,
    createAnotherChild,
    isLoading: query.isLoading,
    query,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface GetExplicitNavigationParams {
  navigationContext: FormNavigationContext;
  config: FullFormConfig;
  dataEngine: ReturnType<FullFormConfig['dataEngine']>;
}

async function getExplicitNavigation({
  navigationContext,
  config,
  dataEngine,
}: GetExplicitNavigationParams): Promise<ExplicitNavigationData | null> {
  if (navigationContext.mode === 'root') {
    return null;
  }

  if (navigationContext.mode !== 'child') {
    return null;
  }

  const lineage = navigationContext.lineage;
  if (!lineage || lineage.length === 0) {
    return null;
  }

  const latestLineage = lineage[lineage.length - 1];
  if (!latestLineage) {
    return null;
  }

  // Get hydrated parent record
  const hydrated = await dataEngine.hydrated.getHydratedRecord({
    recordId: latestLineage.recordId,
    revisionId: latestLineage.revisionId,
  });

  const link = config.navigation.getToRecordLink({
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
    },
    fullContext: navigationContext,
  };
}

interface GetImpliedNavigationParams {
  recordId: string;
  revisionId: string;
  dataEngine: ReturnType<FullFormConfig['dataEngine']>;
  uiSpec: UISpecification;
}

async function getImpliedNavigation({
  recordId,
  revisionId,
  dataEngine,
  uiSpec,
}: GetImpliedNavigationParams): Promise<ImpliedNavigationEntry[] | null> {
  const hydrated = await dataEngine.hydrated.getHydratedRecord({
    recordId,
    revisionId,
  });

  return await getImpliedNavigationRelationships(
    hydrated.revision,
    dataEngine,
    uiSpec
  );
}
