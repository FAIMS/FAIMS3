import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  ProjectID,
  RecordID,
} from '@faims3/data-model';
import {DataView, DataViewProps} from '@faims3/forms';
import {Button, CircularProgress, Stack} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {useNavigate, useParams} from 'react-router';
import {useSearchParams} from 'react-router-dom';
import {getEditRecordRoute, getViewRecordRoute} from '../../constants/routes';
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

  return (
    <Stack spacing={1}>
      <Button
        fullWidth={false}
        variant="outlined"
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
      >
        Edit record
      </Button>
      <DataView {...props}></DataView>
    </Stack>
  );
};
