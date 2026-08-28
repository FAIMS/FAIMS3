/* Provide the NotebookView component that allows different
 * UI components for different kinds of notebook, notably those that
 * have associated plans and those that do not
 */

import {
  Action,
  CompiledNotebookUiSpec,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  FormUpdateData,
  MinimalRecordMetadata,
  ProjectStatus,
} from '@faims3/data-model';
import NotebookComponent from '.';
import {addAlert} from '../../../context/slices/alertSlice';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {Project} from '../../../context/slices/projectSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import * as ROUTES from '../../../constants/routes';
import {
  invalidateProjectHydration,
  invalidateProjectRecordList,
  useIsAuthorisedTo,
  useIsRecordDownloadUnderway,
  usePlanRecordStatusReports,
  useRecordList,
} from '../../../utils/customHooks';
import CircularLoading from '../ui/circular_loading';
import {getNotebookView, PlanChooser, resolvePlanViews} from './plans';
import {useRecordAudit} from '../../../utils/apiHooks/notebooks';
import {useCallback, useMemo, useState} from 'react';
import {config} from '../../../buildconfig';
import {useQueryClient} from '@tanstack/react-query';
import {NotebookViewComponentProps} from './types';
import {localGetDataDb} from '../../../utils/database';
import {useNavigate, useParams} from 'react-router-dom';
import NotebookSettings from './settings';
import {MetadataDisplayComponent} from './MetadataDisplay';
import {OverviewMap} from './OverviewMap';

type NotebookViewProps = {
  project: Project;
};

/**
 * NotebookView takes the place of the old NotebookComponent as the
 * way to display a notebook. It defaults to the old view but can be
 * overridden if there is a plan associated with the notebook that has
 * a custom view registered for it.
 *
 * Here we do as much of the work in preparing to render the notebook
 * as we can so that the renderer doesn't have to reference arbitrary
 * parts of the app state.
 *
 */
export function NotebookView({project}: NotebookViewProps) {
  const {uiSpecificationId} = project;
  const uiSpecification = compiledSpecService.getSpec(uiSpecificationId);
  if (!uiSpecification) {
    return <CircularLoading label="Loading" />;
  } else {
    return (
      <NotebookViewWithSpec
        project={project}
        uiSpecification={uiSpecification}
      />
    );
  }
}

/*
 * The core component is called when we know we have the compiled uiSpecification
 * This avoids conditional hooks in the main component
 */
function NotebookViewWithSpec({
  project,
  uiSpecification,
}: {
  project: Project;
  uiSpecification: CompiledNotebookUiSpec;
}) {
  const activeUser = useAppSelector(selectActiveUser);
  const [query, setQuery] = useState<string>('');
  const queryClient = useQueryClient();

  const isAllowedToAddRecords =
    useIsAuthorisedTo({
      action: Action.CREATE_PROJECT_RECORD,
      resourceId: project.projectId,
    }) && project.status === ProjectStatus.OPEN;

  // Records on the server may still be downloading into the local database:
  // while true, a record's absence from the lists proves nothing.
  const isDownloadingRecords = useIsRecordDownloadUnderway({
    serverId: project.serverId,
    projectId: project.projectId,
    syncMode: project.database?.syncMode ?? 'none',
  });

  // get the sync status of records in this project
  const recordStatus = useRecordAudit({
    projectId: project.projectId,
    listingId: project.serverId,
    username: activeUser?.username ?? '',
  });

  const records = useRecordList({
    query: query,
    // Profiling enabled when debugging
    enableProfiling: config.debugApp,
    projectId: project.projectId,
    filterDeleted: true,
    // refetch every 10 seconds (local only fetch - no network traffic here)
    metadataRefreshIntervalMs: 10000,
    uiSpecification: uiSpecification,
  });

  const refreshRecordList = useCallback(() => {
    invalidateProjectRecordList({
      client: queryClient,
      projectId: project.projectId,
      reset: true,
    });
    invalidateProjectHydration({
      client: queryClient,
      projectId: project.projectId,
      reset: true,
    });
  }, [queryClient, project.projectId]);

  // Set up the data engine for creating new records

  const dataDb = localGetDataDb(project.projectId);
  const dataEngine = useCallback(() => {
    return new DataEngine({
      dataDb: dataDb as DatabaseInterface<DataDocument>,
      uiSpec: uiSpecification,
    });
  }, [dataDb, uiSpecification]);

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const {tab} = useParams<{tab?: string}>();

  // Replace rather than push, so leaving a notebook costs one Back press.
  // Choosing a plan is the exception: it pushes, so Back returns to the
  // chooser rather than leaving the notebook.
  const setTab = useCallback(
    (nextTab: string, {push = false}: {push?: boolean} = {}) => {
      navigate(
        ROUTES.getNotebookRoute({
          serverId: project.serverId,
          projectId: project.projectId,
          tab: nextTab,
        }),
        {replace: !push}
      );
    },
    [navigate, project.serverId, project.projectId]
  );

  /**
   * Create a new record - function passed in to the view component to create new records,
   *  bundles up all of the app internal access that is needed to do this so that the
   *  view component can be self-contained.
   *
   * Create the record with possible initial data and navigate to the record edit page with mode=new
   * adds a planReference to the record if provided
   *
   * @param viewsetName The name of the viewset for the new record
   * @param data The initial data for the new record
   * @param planReference Optional plan reference for the new record
   */
  const createRecord = useCallback(
    async (
      viewsetName: string,
      data: Record<string, any>,
      planReference?: string
    ) => {
      // create the new record then navigate to its edit page with mode=new

      // Create the initial data for the new record in the right shape
      const initial: FormUpdateData = {};
      for (const [key, value] of Object.entries(data)) {
        initial[key] = {data: value};
      }

      if (!(activeUser && isAllowedToAddRecords)) return;

      try {
        // The engine tidies up after itself when applying initial data fails
        // (the half-created record is deleted before the error propagates),
        // so a rejection here always means no record exists.
        const {record} = await dataEngine().form.createRecord({
          formId: viewsetName,
          createdBy: activeUser.username,
          // Omit empty initial data so a data-less create is a single write
          initial: Object.keys(initial).length > 0 ? initial : undefined,
          planReference,
        });
        navigate(
          ROUTES.getEditRecordRoute({
            serverId: project.serverId,
            projectId: project.projectId,
            tab,
            recordId: record._id,
            mode: 'new',
          })
        );
      } catch (err) {
        // Surface the error and resolve (do not rethrow): a caller awaiting
        // this to re-enable its UI must not see a rejection it would treat as
        // an unhandled failure.
        console.error('Failed to create record', viewsetName, err);
        dispatch(
          addAlert({
            message: 'Record could not be created',
            severity: 'error',
          })
        );
      }
    },
    [
      activeUser,
      isAllowedToAddRecords,
      dataEngine,
      navigate,
      project.serverId,
      project.projectId,
      tab,
      dispatch,
    ]
  );

  // View/Edit an existing record by navigating to the record view page
  const navigateToRecord = useCallback(
    (record: MinimalRecordMetadata) => {
      navigate(
        ROUTES.getViewRecordRoute({
          serverId: project.serverId,
          projectId: project.projectId,
          tab,
          recordId: record.recordId,
        })
      );
    },
    [navigate, project.serverId, project.projectId, tab]
  );

  // Every plan the notebook carries that has a view registered for it, and
  // which one the route addresses.
  const {
    plans: planViews,
    active: activePlan,
    showChooser,
    planTab,
  } = useMemo(
    () =>
      resolvePlanViews({
        uiDefinition: project.uiDefinition,
        tab,
        getView: getNotebookView,
      }),
    [project.uiDefinition, tab]
  );

  // A plan view sets its own slug; re-prefix it so the URL keeps naming the
  // plan on screen.
  const setPlanTab = useCallback(
    (nextTab: string) => {
      setTab(
        activePlan ? ROUTES.joinPlanTab(activePlan.planId, nextTab) : nextTab
      );
    },
    [setTab, activePlan]
  );

  // Completion roll-up per plan-claiming record, for its cell's status; only a
  // registered plan view can display it, so gate the walks on one
  const planRecordStatusReports = usePlanRecordStatusReports({
    projectId: project.projectId,
    uiSpecification,
    records: records.allRecords,
    enabled: planViews.length > 0,
  });

  const props: NotebookViewComponentProps = useMemo(
    () => ({
      project,
      tab: planTab,
      plan: activePlan?.plan,
      planId: activePlan?.planId,
      uiSpecification: uiSpecification,
      actions: {
        refreshRecordList,
        setQuery,
        createRecord,
        navigateToRecord,
        setTab: setPlanTab,
      },
      status: {
        // Never-loaded, not merely in-flight: the hook's isLoading stays true
        // after a failed initial fetch (which would otherwise present the
        // empty fallback list as a loaded, empty notebook) and goes false
        // once the list has loaded, even if a later background refetch fails
        // while it is still being served. The query refetches on an interval,
        // so an errored initial load is effectively still loading.
        isLoading: records.isLoading,
        isAllowedToAddRecords,
        // The record list is filtered to what the user may read; the hook
        // reports whether that filter can hide records, from the same token
        // the filter reads.
        canReadAllRecords: records.canReadAllRecords,
        isDownloadingRecords,
      },
      records: {
        allRecords: records.allRecords,
        myRecords: records.myRecords,
        otherRecords: records.otherRecords,
        syncStatus: recordStatus.data ?? {status: {}, recordHashes: {}},
        planRecordStatusReports,
      },
      components: {
        NotebookSettings: () => <NotebookSettings uiSpec={uiSpecification} />,
        MetadataDisplayComponent: () => (
          <MetadataDisplayComponent
            project={project}
            templateId={project.templateId}
          />
        ),
        OverviewMap: () => (
          <OverviewMap
            serverId={project.serverId}
            records={records}
            project_id={project.projectId}
            uiSpec={uiSpecification}
          />
        ),
      },
    }),
    [
      project,
      tab,
      uiSpecification,
      refreshRecordList,
      setQuery,
      createRecord,
      navigateToRecord,
      setTab,
      isAllowedToAddRecords,
      isDownloadingRecords,
      records,
      recordStatus.data,
      planRecordStatusReports,
      planTab,
      activePlan,
      setPlanTab,
    ]
  );

  // more than one workflow to pick from, and none picked yet
  if (showChooser) {
    return (
      <PlanChooser
        plans={planViews}
        // Keep any slug the link carried, so an unqualified deep link still
        // lands on its tab. With none, the plan resolves its own default.
        onSelect={(planId: string) =>
          setTab(ROUTES.joinPlanTab(planId, planTab ?? ''), {push: true})
        }
      />
    );
  }

  // delegate to the plan view component
  if (activePlan) {
    const {Component} = activePlan;
    return <Component {...props} />;
  }

  // fallback to the default notebook component
  // TODO: port this component to use the same interface
  // as our custom plan view components once we have sorted
  // out what that interface looks like
  return <NotebookComponent project={project} tab={tab} setTab={setTab} />;
}
