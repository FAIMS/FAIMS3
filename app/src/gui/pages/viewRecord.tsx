/**
 * ViewRecordPage - Read-only view of a FAIMS record with tabbed navigation.
 *
 * Tabs:
 * - Record: Displays the form data in read-only mode with navigation to
 *   parent/linked records and an edit button.
 * - Info: Shows record metadata (creation/modification details) and provides
 *   delete functionality.
 *
 * Features:
 * - Tab state synchronized with URL query parameter (?tab=view|info)
 * - Fetches and caches record data via TanStack Query
 * - Resolves implied parent/linked relationships for navigation
 * - Supports revision viewing via ?revisionId parameter
 *
 * ROUTE:
 * /surveys/:serverId/:projectId/view-record/:recordId?tab=view|info&revisionId=:revisionId
 */
import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  ProjectID,
  RecordID,
} from '@faims3/data-model';
import {
  DataView,
  DataViewProps,
  getImpliedNavigationRelationships,
  ImpliedRelationship,
  NavigationButtonsTemplate,
} from '@faims3/forms';
import EditIcon from '@mui/icons-material/Edit';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Tab,
  Typography,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import React, {useCallback} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {getMapConfig} from '../../buildconfig';
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
import {localGetDataDb} from '../../utils/database';
import RecordDelete from '../components/notebook/delete';
import RecordMeta from '../components/record/meta';
import {theme} from '../themes';
import UGCReport from '../components/record/UGCReport';

/**
 * Available tabs for the record view page
 */
const RECORD_TABS = {
  VIEW: 'view',
  INFO: 'info',
} as const;

type RecordTab = (typeof RECORD_TABS)[keyof typeof RECORD_TABS];

const TAB_QUERY_PARAM = 'tab';
const DEFAULT_TAB: RecordTab = RECORD_TABS.VIEW;

/**
 * Type guard to check if a string is a valid RecordTab
 */
function isValidTab(value: string | null): value is RecordTab {
  return (
    value !== null && Object.values(RECORD_TABS).includes(value as RecordTab)
  );
}

/**
 * Hook to manage tab state synchronized with URL query parameters
 */
function useTabState(): [RecordTab, (tab: RecordTab) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = React.useMemo(() => {
    const tabParam = searchParams.get(TAB_QUERY_PARAM);
    return isValidTab(tabParam) ? tabParam : DEFAULT_TAB;
  }, [searchParams]);

  const setTab = useCallback(
    (newTab: RecordTab) => {
      setSearchParams(
        prev => {
          const updated = new URLSearchParams(prev);
          if (newTab === DEFAULT_TAB) {
            // Remove the param if it's the default to keep URL clean
            updated.delete(TAB_QUERY_PARAM);
          } else {
            updated.set(TAB_QUERY_PARAM, newTab);
          }
          return updated;
        },
        {replace: true}
      );
    },
    [setSearchParams]
  );

  return [currentTab, setTab];
}

/**
 * Props for the InfoTabContent component
 */
interface InfoTabContentProps {
  projectId: ProjectID;
  recordId: RecordID;
  serverId: string;
  hrid: string;
  revisionId: string;
  dataEngine: DataEngine;
}

/**
 * Content for the Info/Meta tab - displays metadata and delete functionality
 */
const InfoTabContent: React.FC<InfoTabContentProps> = ({
  projectId,
  recordId,
  serverId,
  dataEngine,
  revisionId,
  hrid,
}) => {
  const nav = useNavigate();

  const handleRefresh = useCallback(() => {
    return new Promise<void>(resolve => {
      nav(getNotebookRoute({serverId, projectId}));
      resolve();
    });
  }, [nav, serverId, projectId]);

  return (
    <Stack spacing={3}>
      <RecordMeta
        project_id={projectId}
        record_id={recordId}
        revision_id={revisionId}
      />
      <Box>
        <RecordDelete
          projectId={projectId}
          hrid={hrid}
          recordId={recordId}
          revisionId={revisionId}
          serverId={serverId}
          showLabel={true}
          handleRefresh={handleRefresh}
        />
      </Box>
      <Stack spacing={1}>
        <Typography variant="h4">Report content</Typography>
        <Typography variant="subtitle1">
          If you believe this record contains inappropriate or objectionable
          content, you can flag it here.
        </Typography>
        <UGCReport
          handleUGCReport={async (val: string | null) => {
            if (val === null) {
              return;
            }
            // Fetch hydrated revision
            const rev = await dataEngine.hydrated.getHydratedRecord({
              recordId,
              revisionId,
            });
            console.log(rev);
            // get the rev
            let updated = rev.revision;
            // set or append
            updated.ugcComment = updated.ugcComment
              ? `${updated.ugcComment};${val}`
              : val;
            // save the update
            await dataEngine.hydrated.updateRevision({
              ...updated,
            });
          }}
        />
      </Stack>
    </Stack>
  );
};

/**
 * Props for the ViewTabContent component
 */
interface ViewTabContentProps {
  formData: NonNullable<
    Awaited<ReturnType<DataEngine['form']['getExistingFormData']>>
  >;
  uiSpec: NonNullable<ReturnType<typeof compiledSpecService.getSpec>>;
  projectId: ProjectID;
  serverId: string;
  impliedRelationships?: ImpliedRelationship[];
  getDataEngine: () => DataEngine;
  getAttachmentService: () => ReturnType<typeof createProjectAttachmentService>;
}

/**
 * Content for the View tab - displays the record data
 */
const ViewTabContent: React.FC<ViewTabContentProps> = ({
  formData,
  uiSpec,
  projectId,
  serverId,
  impliedRelationships,
  getDataEngine,
  getAttachmentService,
}) => {
  const nav = useNavigate();

  const nestedEditButton: React.FC<{recordId: string}> = props => (
    <Button
      variant="outlined"
      startIcon={<EditIcon />}
      onClick={() => {
        nav(
          getEditRecordRoute({
            projectId,
            recordId: props.recordId,
            serverId,
            mode: 'parent',
          })
        );
      }}
      sx={{flexShrink: 0}}
    >
      Edit record
    </Button>
  );

  const dataViewProps: DataViewProps = {
    viewsetId: formData.formId,
    config: {debugMode: false},
    hydratedRecord: formData.context.record,
    trace: [],
    uiSpecification: uiSpec,
    formData: formData.data,
    hrid: formData.context.hrid,
    tools: {
      getAttachmentService,
      getDataEngine,
      getRecordRoute: params =>
        getViewRecordRoute({
          projectId,
          recordId: params.recordId,
          serverId,
          revisionId: params.revisionId,
        }),
      editRecordButtonComponent: nestedEditButton,
      navigateToRecord: params => {
        nav(
          getViewRecordRoute({
            projectId,
            recordId: params.recordId,
            serverId,
            revisionId: params.revisionId,
          })
        );
      },
      getMapConfig,
    },
  };

  // Build navigation buttons
  const navButtons: Array<{
    label: string;
    subtitle?: string;
    onClick: () => void;
  }> = [];

  if (impliedRelationships && impliedRelationships.length > 0) {
    for (const relationship of impliedRelationships) {
      navButtons.push({
        label: `View ${
          relationship.type === 'linked' ? 'linked' : 'parent'
        } record (${relationship.formLabel})`,
        subtitle: relationship.hrid,
        onClick: () =>
          nav(
            getViewRecordRoute({
              projectId,
              recordId: relationship.recordId,
              serverId,
            })
          ),
      });
    }
  }

  navButtons.push({
    label: 'Return to record list',
    onClick: () => nav(getNotebookRoute({serverId, projectId})),
  });

  return (
    <Stack spacing={2}>
      <NavigationButtonsTemplate buttons={navButtons} marginBottom={0} />
      <DataView {...dataViewProps} />
    </Stack>
  );
};

/**
 * Main ViewRecordPage component with tab navigation
 */
export const ViewRecordPage: React.FC = () => {
  const {serverId, projectId, recordId} = useParams<{
    serverId: string;
    projectId: ProjectID;
    recordId: RecordID;
  }>();

  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const specifiedRevisionId = searchParams.get('revisionId') ?? undefined;

  const [activeTab, setActiveTab] = useTabState();

  const activeUser = useAppSelector(selectActiveUser);

  // Early returns for missing data
  if (!activeUser) {
    return <div>Please log in to view records.</div>;
  }

  if (!serverId || !projectId || !recordId) {
    return null;
  }

  const project = useAppSelector(state => selectProjectById(state, projectId));
  if (!project) {
    return null;
  }

  const {uiSpecificationId: uiSpecId} = project;
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;
  if (!uiSpec) {
    return <div>UI Specification not found</div>;
  }

  const dataDb = localGetDataDb(projectId);

  const getDataEngine = useCallback(
    () =>
      new DataEngine({
        dataDb: dataDb as DatabaseInterface<DataDocument>,
        uiSpec,
      }),
    [dataDb, uiSpec]
  );

  const getAttachmentService = useCallback(
    () => createProjectAttachmentService(projectId),
    [projectId]
  );

  // Fetch form data
  const {
    data: formData,
    isError,
    isPending,
    isRefetching,
    error,
  } = useQuery({
    queryKey: ['formData', recordId, specifiedRevisionId],
    queryFn: async () =>
      getDataEngine().form.getExistingFormData({
        recordId,
        revisionId: specifiedRevisionId,
      }),
    networkMode: 'always',
    refetchOnMount: 'always',
    staleTime: 0,
    gcTime: 0,
  });

  const revisionId = specifiedRevisionId ?? formData?.context.revision._id;

  // Fetch implied relationships
  const {data: impliedRelationships} = useQuery({
    queryKey: [
      'impliedRelationships',
      recordId,
      formData?.context.revision.relationship,
    ],
    queryFn: async (): Promise<ImpliedRelationship[]> => {
      if (!formData) return [];
      return getImpliedNavigationRelationships(
        formData.context.revision,
        getDataEngine(),
        uiSpec
      );
    },
    enabled: !!formData,
    networkMode: 'always',
    staleTime: 0,
    gcTime: 0,
  });

  // Handle tab change
  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: string) => {
      if (isValidTab(newValue)) {
        setActiveTab(newValue);
      }
    },
    [setActiveTab]
  );

  // Loading state
  if (isPending || isRefetching) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Box p={2}>
        <Typography color="error">
          An error occurred while fetching record data. Error:{' '}
          {error?.message ?? 'unknown'}.
        </Typography>
      </Box>
    );
  }

  if (!formData) {
    return (
      <Box p={2}>
        <Typography color="error">Record data not found.</Typography>
      </Box>
    );
  }

  const formLabel = uiSpec.viewsets[formData.formId]?.label ?? formData.formId;

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: {xs: 'column', sm: 'row'},
          justifyContent: {xs: 'space-between', sm: 'flex-start'},
          alignItems: {xs: 'flex-start', sm: 'center'},
          paddingLeft: 2,
          gap: 2,
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h3">Viewing {formLabel}</Typography>
          <Typography variant="h4" color={theme.palette.text.secondary}>
            {formData.context.hrid}
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => {
            nav(
              getEditRecordRoute({
                projectId,
                recordId,
                serverId,
                mode: 'parent',
              })
            );
          }}
          sx={{flexShrink: 0}}
        >
          Edit record
        </Button>
      </Box>

      {/* Tab Navigation */}
      <TabContext value={activeTab}>
        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <TabList onChange={handleTabChange} aria-label="Record view tabs">
            <Tab label="Record" value={RECORD_TABS.VIEW} />
            <Tab label="Info" value={RECORD_TABS.INFO} />
          </TabList>
        </Box>

        <TabPanel value={RECORD_TABS.VIEW} sx={{p: 0, pt: 2}}>
          <ViewTabContent
            formData={formData}
            uiSpec={uiSpec}
            projectId={projectId}
            serverId={serverId}
            impliedRelationships={impliedRelationships}
            getDataEngine={getDataEngine}
            getAttachmentService={getAttachmentService}
          />
        </TabPanel>

        <TabPanel value={RECORD_TABS.INFO} sx={{p: 0, pt: 2}}>
          {revisionId ? (
            <InfoTabContent
              dataEngine={getDataEngine()}
              projectId={projectId}
              hrid={formData.context.hrid}
              recordId={recordId}
              serverId={serverId}
              revisionId={revisionId}
            />
          ) : (
            <CircularProgress />
          )}
        </TabPanel>
      </TabContext>
    </Stack>
  );
};
