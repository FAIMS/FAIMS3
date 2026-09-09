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
  relatedRecordAvpEntries,
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
import {recordsClaimedBy} from './plans/planViewRecords';
import {useRecordAudit} from '../../../utils/apiHooks/notebooks';
import {useCallback, useMemo, useState} from 'react';
import {config} from '../../../buildconfig';
import {useQueryClient} from '@tanstack/react-query';
import {NotebookViewComponentProps} from './types';
import {localGetDataDb} from '../../../utils/database';
import {useNotebookRoute} from '../../../context/notebookRoute';
import {useNotebookTab, usePlanTab} from '../../../context/notebookViewTab';
import {useNavigate} from 'react-router-dom';
import NotebookSettings from './settings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {Button} from '@mui/material';
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

  // Change plan is the way back to the chooser.
  const {notebook, showPlan} = useNotebookRoute();
  const {planId} = notebook;

  // The search filters the whole notebook, so a search left running on one
  // plan would thin what the next one sees, down to a map grid drawing cells
  // as unclaimed. Reset while rendering the new plan rather than in an effect,
  // so no frame ever draws one plan against another's filtered records.
  const [queriedPlanId, setQueriedPlanId] = useState(planId);
  if (queriedPlanId !== planId) {
    setQueriedPlanId(planId);
    setQuery('');
  }

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
            ...notebook,
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
      notebook,
      dispatch,
    ]
  );

  /**
   * Create a child record of an existing record and navigate to its edit page.
   *
   * Writes both halves of the link the related record field would have
   * written: the `parent` edge on the new record, and the new record's entry
   * in the parent's related-record field, so a view that creates a child
   * leaves the parent form reading as it would after an in-form create.
   *
   * @param formType The viewset of the new child record
   * @param parentRecordId The record the child hangs off
   * @param parentFieldId The parent's related-record field holding the link
   */
  const createChildRecord = useCallback(
    async ({
      formType,
      parentRecordId,
      parentFieldId,
    }: {
      formType: string;
      parentRecordId: string;
      parentFieldId: string;
    }) => {
      if (!(activeUser && isAllowedToAddRecords)) return;

      // The pair a Child related-record field stores, the parent's view first.
      const relationTypeVocabPair: [string, string] = [
        'has child',
        'is child of',
      ];
      let isChildCreated = false;
      try {
        const engine = dataEngine();
        const {record} = await engine.form.createRecord({
          formId: formType,
          createdBy: activeUser.username,
          relationship: {
            parent: [
              {
                recordId: parentRecordId,
                fieldId: parentFieldId,
                relationTypeVocabPair,
              },
            ],
          },
        });
        isChildCreated = true;

        // Read the head rather than trusting the record list, which the
        // notebook polls and can be a revision behind.
        const existing = await engine.form.getExistingFormData({
          recordId: parentRecordId,
        });
        // A related-record value is a list or a single bare entry, so read it
        // the way every other reader does.
        const currentValue = existing.data?.[parentFieldId]?.data;
        const links =
          currentValue === undefined || currentValue === null
            ? []
            : relatedRecordAvpEntries(currentValue);
        const link = {
          record_id: record._id,
          relation_type_vocabPair: relationTypeVocabPair,
        };
        // A single-link field stores one link, not a list of one.
        const isMultipleLink =
          uiSpecification.fields[parentFieldId]?.['component-parameters']
            ?.multiple === true;
        const revision = await engine.form.createRevision({
          recordId: parentRecordId,
          revisionId: existing.revisionId,
          createdBy: activeUser.username,
        });
        // updateRevision replaces the revision's whole field map, so the
        // parent's other values go back with it rather than being dropped.
        await engine.form.updateRevision({
          revisionId: revision._id,
          recordId: parentRecordId,
          update: {
            ...existing.data,
            [parentFieldId]: {
              ...existing.data?.[parentFieldId],
              data: isMultipleLink ? [...links, link] : link,
            },
          },
          mode: 'parent',
          updatedBy: activeUser.username,
          bumpRecordUpdatedAt: true,
        });

        navigate(
          ROUTES.getEditRecordRoute({
            ...notebook,
            recordId: record._id,
            mode: 'new',
          })
        );
      } catch (err) {
        // Surface and resolve, like createRecord. The child is written before
        // the parent's link, so a failure after it leaves a record that exists
        // but is not listed on its parent.
        console.error('Failed to create child record', formType, err);
        dispatch(
          addAlert({
            message: isChildCreated
              ? 'Record was created but could not be linked to its parent'
              : 'Record could not be created',
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
      notebook,
      uiSpecification,
      dispatch,
    ]
  );

  // View/Edit an existing record by navigating to the record view page
  const navigateToRecord = useCallback(
    (record: MinimalRecordMetadata) => {
      navigate(
        ROUTES.getViewRecordRoute({
          ...notebook,
          recordId: record.recordId,
        })
      );
    },
    [navigate, notebook]
  );

  // Every plan the notebook carries that has a view registered for it, and
  // which one the route addresses.
  const {
    plans: planViews,
    active: activePlan,
    showChooser,
  } = useMemo(
    () =>
      resolvePlanViews({
        uiDefinition: project.uiDefinition,
        planId,
        getView: getNotebookView,
      }),
    [project.uiDefinition, planId]
  );

  // A plan's tab is its own, so a plan free to model screens or regions rather
  // than tabs leaves the tabs the default view carries alone.
  const notebookTab = useNotebookTab();
  const planTab = usePlanTab();
  const tab = activePlan ? planTab : notebookTab;

  // Completion roll-up per record the plan on screen claims, for its cell's
  // status; only that plan's view can display it, so the walks stop at its own
  const planRecordStatusReports = usePlanRecordStatusReports({
    projectId: project.projectId,
    uiSpecification,
    records: records.allRecords,
    planId: activePlan?.plan.planId,
  });

  // Every record the plan on screen claims. Scoping once here hands a plan view
  // and the map beside it one answer, rather than each scoping again. Without a
  // plan nothing reads these: the chooser and the default view take no props.
  const planRecords = useMemo(
    () =>
      activePlan
        ? recordsClaimedBy({
            records: records.allRecords,
            planId: activePlan.plan.planId,
          })
        : [],
    [records.allRecords, activePlan]
  );

  const props: NotebookViewComponentProps = useMemo(
    () => ({
      project,
      tab,
      plan: activePlan?.plan,
      uiSpecification: uiSpecification,
      actions: {
        refreshRecordList,
        setQuery,
        createRecord,
        createChildRecord,
        navigateToRecord,
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
        planRecords,
        notebookRecords: records.allRecords,
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
        OverviewMap: ({records: plotted}) => (
          <OverviewMap
            // The plan's own records unless the view asks for others, so
            // tapping a pin cannot open a record the list beside it says is
            // not there.
            records={{allRecords: plotted ?? planRecords}}
            project_id={project.projectId}
            uiSpec={uiSpecification}
          />
        ),
      },
    }),
    [
      project,
      uiSpecification,
      refreshRecordList,
      setQuery,
      createRecord,
      createChildRecord,
      navigateToRecord,
      tab,
      isAllowedToAddRecords,
      isDownloadingRecords,
      records,
      recordStatus.data,
      planRecordStatusReports,
      planRecords,
      activePlan,
    ]
  );

  // more than one plan to pick from, and none picked yet
  if (showChooser) {
    return (
      <PlanChooser
        plans={planViews.map(({plan}) => plan)}
        heading={uiSpecification.settings.planChooserMarkdown}
        onSelect={showPlan}
      />
    );
  }

  // delegate to the plan view component
  if (activePlan) {
    const {Component} = activePlan;
    // Back leaves the notebook, so where there was a choice of plan to make,
    // this is the way back to it.
    return planViews.length > 1 ? (
      // No wrapper, so the plan view's own children stay direct children of the
      // page's Stack and a plan lays out the same however many sit beside it
      <>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => showPlan()}
          data-testid="plan-change"
          sx={{alignSelf: 'flex-start', textTransform: 'none'}}
        >
          Change plan
        </Button>
        <Component {...props} />
      </>
    ) : (
      <Component {...props} />
    );
  }

  // fallback to the default notebook component
  // TODO: port this component to use the same interface
  // as our custom plan view components once we have sorted
  // out what that interface looks like
  return <NotebookComponent project={project} tab={tab} />;
}
