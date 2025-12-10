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
  NavigationButtonsTemplate,
} from '@faims3/forms';
import EditIcon from '@mui/icons-material/Edit';
import {Box, Button, CircularProgress, Stack, Typography} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import React from 'react';
import {useNavigate, useParams} from 'react-router';
import {useSearchParams} from 'react-router-dom';
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

export const ViewRecordPage = () => {
  // Unpack route params
  const {serverId, projectId, recordId} = useParams<{
    serverId: string;
    projectId: ProjectID;
    recordId: RecordID;
  }>();

  const nav = useNavigate();

  // Unpack search params
  const [params] = useSearchParams();
  const revisionId = params.get('revisionId') as string | undefined;

  // Hydrate record
  const activeUser = useAppSelector(selectActiveUser);

  if (!activeUser) {
    return <div>Please log in to edit records.</div>;
  }
  // TODO: these missing info checks should probably just redirect back to the home page
  //  maybe with a flash message.
  if (!serverId || !projectId || !recordId) return <></>;

  // Get project and spec
  const project = useAppSelector(state => selectProjectById(state, projectId));
  if (!project) return <></>;
  const {uiSpecificationId: uiSpecId} = project;
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;
  if (!uiSpec) return <div>UI Specification not found</div>;

  const dataDb = localGetDataDb(projectId);
  const getDataEngine = () => {
    return new DataEngine({
      dataDb: dataDb as DatabaseInterface<DataDocument>,
      uiSpec,
    });
  };

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
      console.log('Re-querying the form data');
      // Get the hydrated record data in the form format
      return await getDataEngine().form.getExistingFormData({
        recordId: recordId,
        revisionId,
      });
    },
    // Try offline
    networkMode: 'always',
    // Always refetch on mount to get fresh data
    refetchOnMount: 'always',
    // Don't cache this
    staleTime: 0,
    gcTime: 0,
  });

  // Fetch implied parent relationship if it exists
  const {data: impliedParent} = useQuery({
    queryKey: [
      'impliedParent',
      recordId,
      formData?.context.revision.relationship?.parent?.recordId,
    ],
    queryFn: async () => {
      if (!formData) return null;

      const revision = formData.context.revision;

      // If we have a relationship in the revision, hydrate the parent
      if (revision.relationship !== undefined) {
        const engine = getDataEngine();
        const parentHydrated = await engine.hydrated.getHydratedRecord({
          recordId: revision.relationship.parent.recordId,
        });

        const parentFormLabel =
          uiSpec.viewsets[parentHydrated.record.formId]?.label ??
          parentHydrated.record.formId;

        return {
          recordId: parentHydrated.record._id,
          hrid: parentHydrated.hrid,
          formId: parentHydrated.record.formId,
          formLabel: parentFormLabel,
        };
      }

      return null;
    },
    enabled: !!formData,
    networkMode: 'always',
    staleTime: 0,
    gcTime: 0,
  });

  // Generate attachment service for this project
  const getAttachmentService = () => {
    return createProjectAttachmentService(projectId);
  };

  if (isPending || isRefetching) {
    return (
      <div>
        <CircularProgress />
      </div>
    );
  }
  if (isError) {
    return (
      <div>
        <p>
          An error occurred while fetching record data. Error:{' '}
          {error?.message ?? 'unknown'}.
        </p>
      </div>
    );
  }

  // Get the display label for the form
  const formLabel = uiSpec.viewsets[formData.formId]?.label ?? formData.formId;

  const nestedEditButton: React.FC<{recordId: string}> = props => {
    return (
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
        sx={{
          flexShrink: 0,
        }}
      >
        Edit record
      </Button>
    );
  };

  const props = {
    viewsetId: formData.formId,
    // TODO disable debug mode
    config: {debugMode: false},
    hydratedRecord: formData.context.record,
    trace: [],
    uiSpecification: uiSpec,
    formData: formData.data,
    hrid: formData.context.hrid,
    tools: {
      getAttachmentService,
      getDataEngine,
      getRecordRoute: params => {
        return getViewRecordRoute({
          projectId,
          recordId: params.recordId,
          serverId,
          revisionId: params.revisionId,
        });
      },
      editRecordButtonComponent: nestedEditButton,
      navigateToRecord(params) {
        nav(
          getViewRecordRoute({
            projectId,
            recordId: params.recordId,
            serverId,
            revisionId: params.revisionId,
          })
        );
      },
    },
  } satisfies DataViewProps;

  // Build navigation buttons array
  const navButtons: Array<{
    label: string;
    subtitle?: string;
    onClick: () => void;
  }> = [];

  // Add implied parent button if it exists
  if (impliedParent) {
    navButtons.push({
      label: `View parent record (${impliedParent.formLabel})`,
      subtitle: impliedParent.hrid,
      onClick: () =>
        nav(
          getViewRecordRoute({
            projectId,
            recordId: impliedParent.recordId,
            serverId,
          })
        ),
    });
  }

  navButtons.push({
    label: 'Return to record list',
    onClick: () => nav(getNotebookRoute({serverId, projectId})),
  });

  return (
    <Stack spacing={2}>
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
        <Typography variant="h5" component="h1">
          Viewing {formLabel}: {formData.context.hrid}
        </Typography>
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
          sx={{
            flexShrink: 0,
          }}
        >
          Edit record
        </Button>
      </Box>
      <Box sx={{pl: 2}}>
        <NavigationButtonsTemplate buttons={navButtons} marginBottom={0} />
      </Box>
      <DataView {...props}></DataView>
    </Stack>
  );
};
