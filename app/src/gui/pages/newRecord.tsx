import {
  ProjectID,
  RecordID,
  RevisionID,
  DataEngine,
  DatabaseInterface,
  DataDocument,
  AvpUpdateMode,
} from '@faims3/data-model';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {EditableFormManager} from '@faims3/forms';
import {localGetDataDb} from '../../utils/database';
import {compiledSpecService} from '../../context/slices/helpers/compiledSpecService';
import {useAppSelector} from '../../context/store';
import {selectProjectById} from '../../context/slices/projectSlice';
import {createProjectAttachmentService} from '../../utils/attachmentService';
import {selectActiveUser} from '../../context/slices/authSlice';
import {getNotebookRoute} from '../../constants/routes';

export const EditRecordPage = () => {
  const {serverId, projectId, recordId} = useParams<{
    serverId: string;
    projectId: ProjectID;
    recordId: RecordID;
  }>();

  // Get mode=XXX from the query params
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') as AvpUpdateMode | 'parent';

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
  if (!serverId) return <></>;
  if (!projectId) return <></>;
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

  // Generate attachment service for this project
  const attachmentEngine = () => {
    return createProjectAttachmentService(projectId);
  };

  const formConfig = {
    context: {
      mode: 'full' as const,
      dataEngine,
      attachmentEngine,
      redirect: {
        toRecord: ({recordId}: {recordId: RecordID}) => {
          console.log('redirect to record', recordId);
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
      trigger: {
        commit: async () => {
          console.log('committing changes');
          // navigate to the project page
          navigate(getNotebookRoute({serverId, projectId}));
        },
      },
    },
  };

  return (
    <div>
      <h2>Editing {recordId}</h2>
      <EditableFormManager mode={mode} activeUser={userId} recordId={recordId} config={formConfig} />
    </div>
  );
};
