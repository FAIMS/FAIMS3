import {
  AvpUpdateMode,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  ProjectID,
  RecordID,
  RevisionID,
} from '@faims3/data-model';
import {EditableFormManager, FullFormConfig} from '@faims3/forms';
import {CircularProgress} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {APP_NAME} from '../../buildconfig';
import {getExistingRecordRoute} from '../../constants/routes';
import {selectActiveUser} from '../../context/slices/authSlice';
import {compiledSpecService} from '../../context/slices/helpers/compiledSpecService';
import {selectProjectById} from '../../context/slices/projectSlice';
import {useAppSelector} from '../../context/store';
import {createProjectAttachmentService} from '../../utils/attachmentService';
import {useUiSpecLayout} from '../../utils/customHooks';
import {localGetDataDb} from '../../utils/database';

const DEFAULT_LAYOUT: 'tabs' | 'inline' = 'tabs';

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

  if (!activeUser) {
    return <div>Please log in to edit records.</div>;
  }
  const userId = activeUser.username;

  // Main page elements
  // - Header with 'back' button and record HRID
  // - breadcrumbs
  // - Tabbed view of the record (View, Edit, Info, Conflicts)

  // TODO: these missing info checks should probably just redirect back to the home page
  //  maybe with a flash message.
  if (!serverId || !projectId) return <></>;
  const project = useAppSelector(state => selectProjectById(state, projectId));
  if (!project) return <></>;
  if (!recordId) return <div>Record ID not specified</div>;

  const {uiSpecificationId: uiSpecId} = project;
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;
  if (!uiSpec) return <div>UI Specification not found</div>;

  const dataDb = localGetDataDb(projectId);
  const dataEngine = () => {
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
      return await dataEngine().form.getExistingFormData({
        recordId: recordId,
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

  // Query to fetch the relevant viewset
  const relevantUiSpec = useUiSpecLayout({dataDb, recordId, uiSpec});

  // Generate attachment service for this project
  const attachmentEngine = () => {
    return createProjectAttachmentService(projectId);
  };

  const formConfig: FullFormConfig = {
    mode: 'full' as const,
    appName: APP_NAME,
    recordId,
    dataEngine,
    attachmentEngine,
    redirect: {
      toRecord: ({
        recordId: targetRecordId,
        mode,
      }: {
        recordId: RecordID;
        mode: AvpUpdateMode;
      }) => {
        // Navigate to the 'new record' page for this record
        console.log('redirect to record', targetRecordId);
        navigate(
          getExistingRecordRoute({
            serverId,
            projectId,
            recordId: targetRecordId,
            mode,
          })
        );
      },
      toRevision: ({
        recordId,
        revisionId,
      }: {
        recordId: RecordID;
        revisionId: RevisionID;
      }) => {
        console.log('redirect to revision', recordId, revisionId);
      },
    },
    user: activeUser.username,
    // Pass through the layout from the spec
    layout: relevantUiSpec.data?.layout ?? DEFAULT_LAYOUT,
  };

  return (
    <div>
      <h2>Editing {recordId}</h2>
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
      ) : (
        <EditableFormManager
          // Force remount if record ID or FormID changes
          key={`${recordId}-${formData.formId}`}
          mode={mode}
          initialData={formData.data}
          revisionId={formData.revisionId}
          existingRecord={formData.context.record}
          formId={formData.formId}
          activeUser={userId}
          recordId={recordId}
          config={formConfig}
        />
      )}
    </div>
  );
};
