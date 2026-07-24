import {
  AvpUpdateMode,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  ProjectID,
  RecordID,
} from '@faims3/data-model';
import {
  AutoIncrementFieldRef,
  EditableFormManager,
  EditableFormManagerHandle,
  FormNavigationChildEntry,
  FormNavigationContext,
  FormNavigationContextSchema,
  FullFormConfig,
  RedirectInfo,
} from '@faims3/forms';
import {
  Alert,
  Button,
  CircularProgress,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  useBlocker,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  config,
  CAPACITOR_PLATFORM,
  getAddressAutosuggestService,
  getMapConfig,
} from '../../buildconfig';
import {
  getEditRecordRoute,
  getNotebookRoute,
  getViewRecordRoute,
} from '../../constants/routes';
import {selectActiveUser} from '../../context/slices/authSlice';
import {compiledSpecService} from '../../context/slices/helpers/compiledSpecService';
import {selectProjectById} from '../../context/slices/projectSlice';
import {useAppSelector} from '../../context/store';
import {createProjectAttachmentService} from '../../utils/attachmentService';
import {useIsOnline, useUiSpecLayout} from '../../utils/customHooks';
import {tryLocalGetDataDb} from '../../utils/database';
import {NOTEBOOK_LIST_ROUTE} from '../../utils/remoteProjectRemoval';
import {useAutoIncrementService} from '../../utils/useIncrementerService';
import {AutoIncrementEditForm} from '../components/autoincrement/edit-form';
import {theme} from '../themes';

const DEFAULT_LAYOUT: 'tabs' | 'inline' = 'tabs';

const DEFAULT_NAVIGATION_STATE: FormNavigationContext = {mode: 'root'};

type UseFormNavigationContextResult = FormNavigationContext;

/** Custom hook to parse out safely navigation context */
export function useFormNavigationContext(): UseFormNavigationContextResult {
  // Get react router nav state
  const location = useLocation();
  const result = FormNavigationContextSchema.safeParse(location.state);
  if (result.success) {
    return result.data;
  }

  if (config.debugApp && location.state !== null) {
    console.warn(
      'Invalid navigation state detected, falling back to root:',
      result.error
    );
  }

  return DEFAULT_NAVIGATION_STATE;
}

/**
 * Edit an existing record (or create via `mode=new`).
 *
 * Hooks are declared unconditionally so upstream notebook removal does not
 * violate the Rules of Hooks; see {@link tryLocalGetDataDb} and
 * `canLoadRecord` gating on queries.
 */
export const EditRecordPage = () => {
  const {serverId, projectId, recordId} = useParams<{
    serverId: string;
    projectId: ProjectID;
    recordId: RecordID;
  }>();

  // Get mode=XXX from the query params
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') as AvpUpdateMode;

  const navigate = useNavigate();
  const activeUser = useAppSelector(selectActiveUser);
  const navigationContext = useFormNavigationContext();
  const project = useAppSelector(state =>
    projectId ? selectProjectById(state, projectId) : undefined
  );

  // Main page elements
  // - Header with 'back' button and record HRID
  // - breadcrumbs
  // - Tabbed view of the record (View, Edit, Info, Conflicts)
  //
  // Missing project/notebook redirects via useEffect below (upstream removal);
  // other missing route params are handled after hooks in the render section.

  const uiSpec = project?.uiSpecificationId
    ? compiledSpecService.getSpec(project.uiSpecificationId)
    : undefined;
  const dataDb =
    projectId && project ? tryLocalGetDataDb(projectId) : undefined;

  // Gate queries and form wiring so hooks stay unconditional while the project
  // is torn down (upstream removal triggers redirect via useEffect below).
  const canLoadRecord = !!(
    serverId &&
    projectId &&
    recordId &&
    project &&
    uiSpec &&
    dataDb &&
    activeUser
  );

  // Backup redirect if the project vanishes while this page is mounted.
  useEffect(() => {
    if (serverId && projectId && !project) {
      navigate(NOTEBOOK_LIST_ROUTE, {replace: true});
    }
  }, [serverId, projectId, project, navigate]);

  // These are handlers passed back from the editable form to assist with
  // navigation management
  const [formHandle, setFormHandle] =
    useState<EditableFormManagerHandle | null>(null);

  // Snackbar to explain when navigation is blocked due to pending saves
  const [navBlockedOpen, setNavBlockedOpen] = useState(false);

  // Are we resolving auto incrementer issues?
  const [resolvingAutoIncrementer, setResolvingAutoIncrementer] = useState<{
    ref: AutoIncrementFieldRef;
    onResolved: () => void;
  } | null>(null);

  // Establish the blocker function (this is how we check if we need to block
  // nav events while anything is still pending)
  const blocker = useBlocker(({currentLocation, nextLocation}) => {
    return (
      (formHandle?.hasPendingChanges() === true ||
        formHandle?.isAttachmentSaving() === true) &&
      currentLocation.pathname !== nextLocation.pathname
    );
  });

  // When navigation is blocked, briefly show a snackbar so the user knows why
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setNavBlockedOpen(true);
    }
  }, [blocker.state]);

  // Also show the snackbar on every browser back/forward attempt that would be blocked
  useEffect(() => {
    const handlePopState = () => {
      const shouldBlock =
        formHandle?.hasPendingChanges() === true ||
        formHandle?.isAttachmentSaving() === true;
      if (shouldBlock) {
        setNavBlockedOpen(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [formHandle]);

  const dataEngine = useCallback(() => {
    return new DataEngine({
      dataDb: dataDb as DatabaseInterface<DataDocument>,
      uiSpec: uiSpec!,
    });
  }, [dataDb, uiSpec]);

  // Fetch initial form data using TanStack Query for caching and loading states
  const {
    data: formData,
    isError,
    isPending,
    isRefetching,
    error,
  } = useQuery({
    queryKey: ['formData', recordId],
    queryFn: async () => {
      // Get the hydrated record data in the form format
      return await dataEngine().form.getExistingFormData({
        recordId: recordId!,
      });
    },
    enabled: canLoadRecord,
    // Try offline
    networkMode: 'always',
    // Always refetch on mount to get fresh data
    refetchOnMount: 'always',
    // Don't cache this
    staleTime: 0,
    gcTime: 0,
  });

  // Query to fetch the relevant viewset
  const relevantUiSpec = useUiSpecLayout({
    recordId: recordId ?? '',
    uiSpec: uiSpec!,
    dataDb: dataDb!,
    enabled: canLoadRecord,
  });

  // Generate attachment service for this project
  const attachmentEngine = useCallback(() => {
    return createProjectAttachmentService(projectId!);
  }, [projectId]);

  // Build the auto incrementer service
  const handleAutoIncrementIssue = useCallback(
    (fieldRefs: AutoIncrementFieldRef[], onResolved: () => void) => {
      console.log(
        'Callback fired - should set the auto incrementer to display'
      );
      if (fieldRefs.length > 0) {
        setResolvingAutoIncrementer({ref: fieldRefs[0], onResolved});
      }
    },
    []
  );
  const incrementerService = useAutoIncrementService({
    projectId: projectId ?? '',
    onIssue: handleAutoIncrementIssue,
  });

  const {isOnline} = useIsOnline();

  const formConfig: FullFormConfig | null = useMemo(() => {
    if (!canLoadRecord || !uiSpec || !dataDb) {
      return null;
    }

    const addressAutosuggestService = getAddressAutosuggestService();
    return {
      mode: 'full' as const,
      platform: CAPACITOR_PLATFORM,
      appName: config.appName,
      recordId: recordId!,
      projectId: projectId!,
      decodedToken: activeUser!.parsedToken,
      recordMode: mode,
      dataEngine,
      attachmentEngine,
      ...(addressAutosuggestService && {addressAutosuggestService}),
      getIsOnline: () => isOnline,
      mapConfig: getMapConfig,
      navigation: {
        navigateToRecordList: {
          label: 'Return to record list',
          navigate: () => {
            navigate(
              getNotebookRoute({serverId: serverId!, projectId: projectId!})
            );
          },
        },
        // Takes you back to view record (note this is only shown if there are no
        // parent navigation history)
        navigateToViewRecord: params => {
          navigate(
            getViewRecordRoute({
              projectId: projectId!,
              recordId: params.recordId,
              serverId: serverId!,
            })
          );
        },
        toRecord: ({
          recordId: targetRecordId,
          mode: targetMode,
          stripNavigationEntry,
          addNavigationEntry,
          scrollTarget,
        }: {
          recordId: RecordID;
          mode: AvpUpdateMode;
          // If you want to push another navigation entry
          addNavigationEntry?: FormNavigationChildEntry;
          // If you want to strip the head nav entry (such as when returning to
          // parent) - how many to take
          stripNavigationEntry?: number;
          scrollTarget?: RedirectInfo;
        }) => {
          let newNavState: FormNavigationContext = navigationContext;
          if (newNavState.mode === 'root') {
            // If in root mode, stripping has no effect, but we can add
            if (addNavigationEntry !== undefined) {
              newNavState = {mode: 'child', lineage: [addNavigationEntry]};
            }
          } else if (newNavState.mode === 'child') {
            if (stripNavigationEntry !== undefined) {
              // Strip off the latest entry
              newNavState.lineage = newNavState.lineage.slice(
                0,
                -stripNavigationEntry
              );
            }
            if (addNavigationEntry !== undefined) {
              // Push new entry
              newNavState.lineage.push(addNavigationEntry);
            }
          }

          // Update scroll target as requested
          newNavState.scrollTarget = scrollTarget;

          navigate(
            getEditRecordRoute({
              serverId: serverId!,
              projectId: projectId!,
              recordId: targetRecordId,
              mode: targetMode,
            }),
            // Include navigation state
            {state: newNavState}
          );
        },
        getToRecordLink(params) {
          return getEditRecordRoute({
            serverId: serverId!,
            projectId: projectId!,
            recordId: params.recordId,
            mode,
          });
        },
        navigateToLink(to) {
          navigate(to);
        },
      },
      user: activeUser!.username,
      // Pass through the layout from the spec
      layout: relevantUiSpec.data?.layout ?? DEFAULT_LAYOUT,
      // Pass in the incrementer service
      incrementerService,
    };
  }, [
    // Be more careful with dependencies here to avoid unnecessary re-renders of
    // the editable form
    canLoadRecord,
    serverId,
    navigationContext,
    projectId,
    recordId,
    mode,
    activeUser,
    relevantUiSpec.data,
    isOnline,
    dataEngine,
    attachmentEngine,
    incrementerService,
    navigate,
    uiSpec,
    dataDb,
  ]);

  const formLabel = formData
    ? uiSpec?.viewsets[formData.formId]?.label
    : undefined;

  const headingSlot: React.ReactNode | undefined = useMemo(() => {
    return formData ? (
      <Stack spacing={1}>
        <Typography variant="h3">
          {mode === 'new' ? 'Creating' : 'Editing'}
          {': '}
          {formLabel ?? formData.formId}
        </Typography>
        {mode === 'parent' && (
          <Typography variant="h4" color={theme.palette.text.secondary}>
            {formData.context.hrid}
          </Typography>
        )}
      </Stack>
    ) : undefined;
  }, [formData, formLabel, mode]);

  // TODO: these missing info checks should probably just redirect back to the home page
  //  maybe with a flash message. (Missing project redirects via useEffect above.)
  if (!activeUser) {
    return <div>Please log in to edit records.</div>;
  }

  if (!serverId || !projectId) {
    return null;
  }

  // Redirect in flight or prerequisites missing — render nothing until settled.
  if (!project || !dataDb) {
    return null;
  }

  if (!uiSpec) {
    return <div>UI Specification not found</div>;
  }

  if (!recordId) {
    return <div>Record ID not specified</div>;
  }

  if (!formConfig) {
    return null;
  }

  return (
    <>
      <div>
        {isPending || isRefetching ? (
          <div>
            <CircularProgress />
          </div>
        ) : isError ? (
          <div>
            <p>
              An error occurred while fetching record data. Error:{' '}
              {error?.message ?? 'unknown'}.
            </p>
          </div>
        ) : formData?.context.revision.deleted ? (
          <Stack spacing={2} sx={{p: 2}}>
            <Alert severity="warning">
              This record has been deleted and cannot be edited.
            </Alert>
            <Button
              variant="outlined"
              onClick={() =>
                navigate(getViewRecordRoute({projectId, recordId, serverId}))
              }
            >
              Open read-only view
            </Button>
            <Button
              variant="text"
              onClick={() => navigate(getNotebookRoute({serverId, projectId}))}
            >
              {`Back to ${config.notebookName}`}
            </Button>
          </Stack>
        ) : (
          <>
            {resolvingAutoIncrementer !== null && (
              <AutoIncrementEditForm
                project_id={projectId}
                form_id={resolvingAutoIncrementer.ref.formId}
                // TODO how do we know this?
                field_id={resolvingAutoIncrementer.ref.fieldId}
                label={resolvingAutoIncrementer.ref.fieldLabel}
                open={!!resolvingAutoIncrementer}
                handleClose={async () => {
                  setResolvingAutoIncrementer(null);
                  // Notify child we are done - prompting a refresh
                  resolvingAutoIncrementer.onResolved();
                }}
              />
            )}
            <EditableFormManager
              // Force remount if record ID or FormID changes
              key={`${recordId}-${formData!.formId}`}
              headingSlot={headingSlot}
              mode={mode}
              initialData={formData!.data}
              revisionId={formData!.revisionId}
              existingRecord={formData!.context.record}
              formId={formData!.formId}
              activeUser={activeUser.username}
              recordId={recordId}
              config={formConfig}
              navigationContext={navigationContext}
              debugMode={config.debugApp}
              // This is a callback to set parent state from the component
              onReady={setFormHandle}
            />
          </>
        )}
      </div>

      <Snackbar
        open={navBlockedOpen}
        autoHideDuration={2500}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setNavBlockedOpen(false);
        }}
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={() => setNavBlockedOpen(false)}
        >
          Saving form data and photos. Please wait...
        </Alert>
      </Snackbar>
    </>
  );
};
