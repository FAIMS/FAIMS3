import {ProjectID, RecordID, RevisionID, DataEngine, DatabaseInterface, DataDocument} from '@faims3/data-model';
import {useParams} from 'react-router-dom';
import {FormManager} from '@faims3/forms';
import {localGetDataDb} from '../../utils/database';
import {compiledSpecService} from '../../context/slices/helpers/compiledSpecService';
import {useAppSelector} from '../../context/store';
import {selectProjectById} from '../../context/slices/projectSlice';
import {useMemo} from 'react';
import {createProjectAttachmentService} from '../../utils/attachmentService';

export const EditRecordPage = () => {
  const {projectId, serverId, recordId, revisionId} = useParams<{
    serverId: string;
    projectId: ProjectID;
    recordId: RecordID;
    revisionId: RevisionID;
  }>();

  // Main page elements
  // - Header with 'back' button and record HRID
  // - breadcrumbs
  // - Tabbed view of the record (View, Edit, Info, Conflicts)

  if (!projectId) return <></>;
  const project = useAppSelector(state => selectProjectById(state, projectId));
  if (!project) return <></>;

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

  const formName = 'Person'; // this is the type of the record we're editing
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
        },
      },
    },
  };

  return (
    <div>
      <h2>Editing {recordId}</h2>
      <FormManager formName={formName} config={formConfig} />
    </div>
  );
};
