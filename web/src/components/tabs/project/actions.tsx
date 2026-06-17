import {AddProjectToTeamDialog} from '@/components/dialogs/add-project-to-team-dialog';
import {ArchiveProjectDialog} from '@/components/dialogs/archive-project-dialog';
import {ProjectStatusDialog} from '@/components/dialogs/change-project-status-dialog';
import {CreateTemplateFromProjectDialog} from '@/components/dialogs/create-template-from-project-dialog';
import {DesignerDialog} from '@/components/dialogs/designer-dialog';
import {EditProjectDetailsDialog} from '@/components/dialogs/edit-project-details-dialog';
import {EditProjectDialog} from '@/components/dialogs/edit-project-dialog';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {
  DEVELOPER_MODE,
  NOTEBOOK_NAME,
  NOTEBOOK_NAME_CAPITALIZED,
} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {
  toDesignerNotebookWithHistory,
  useDesignerSaveMutation,
} from '@/designer/integration';
import type {NotebookWithHistory} from '@/designer/state/initial';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {generateTestRecordsForProject} from '@/hooks/project-hooks';
import {useGetProject} from '@/hooks/queries';
import {Route} from '@/routes/_protected/projects/$projectId';
import {
  Action,
  getUserResourcesForAction,
  ProjectStatus,
} from '@faims3/data-model';
import {Input} from '@mui/material';
import {useQueryClient} from '@tanstack/react-query';
import {useMemo, useState} from 'react';

/**
 * ProjectActions component renders action cards for editing and closing a project.
 * It provides options to edit the project design and close the project, along with
 * relevant warnings and descriptions.
 *
 * @param {ProjectActionsProps} props - The properties object.
 * @param {string} props.projectId - The unique identifier of the project.
 * @returns {JSX.Element} The rendered ProjectActions component.
 */
const ProjectActions = (): JSX.Element => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data, isLoading} = useGetProject({user, projectId});
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);

  // State for generating test records
  const [generateCount, setGenerateCount] = useState('10');
  // Prepare notebook data for the Designer
  const initialNotebook = useMemo<NotebookWithHistory | undefined>(() => {
    return toDesignerNotebookWithHistory(data);
  }, [data]);

  // PUT notebook JSON from the designer; react-query updates cache on success.
  const saveProjectNotebook = useDesignerSaveMutation({
    resourceType: 'projects',
    apiResourceType: 'notebooks',
    resourceId: projectId,
    token: user?.token,
  });

  // need to invalidate the project query after upload
  const uploadProjectCallback = () => {
    queryClient.invalidateQueries({queryKey: ['projects', projectId]});
  };

  const handleEditorClose = (file?: File) => {
    if (file) saveProjectNotebook.mutate(file);
    setEditorOpen(false);
  };

  const canUpdateProjectDetails = useIsAuthorisedTo({
    action: Action.UPDATE_PROJECT_DETAILS,
    resourceId: projectId,
  });

  const canEditProject = useIsAuthorisedTo({
    action: Action.UPDATE_PROJECT_UISPEC,
    resourceId: projectId,
  });

  const canChangeProjectStatus = useIsAuthorisedTo({
    action: Action.CHANGE_PROJECT_STATUS,
    resourceId: projectId,
  });

  // can we change the project team?
  const canAddProjectToTeam = useIsAuthorisedTo({
    action: Action.CHANGE_PROJECT_TEAM,
    resourceId: projectId,
  });

  /** Matches {@link CreateTemplateFromProjectForm}: global create or any permitted team. */
  const canCreateTemplateFromProject =
    useIsAuthorisedTo({action: Action.CREATE_TEMPLATE}) ||
    getUserResourcesForAction({
      decodedToken: user?.decodedToken,
      action: Action.CREATE_TEMPLATE_IN_TEAM,
    }).length > 0;

  const canReadProjectMetadata = useIsAuthorisedTo({
    action: Action.READ_PROJECT_METADATA,
    resourceId: projectId,
  });

  const canGenerateTestRecords = useIsAuthorisedTo({
    action: Action.GENERATE_RANDOM_PROJECT_RECORDS,
    resourceId: projectId,
  });

  const projectIsClosed = data?.status === ProjectStatus.CLOSED;

  const canChangeArchive = useIsAuthorisedTo({
    action: Action.CHANGE_PROJECT_ARCHIVE_STATUS,
    resourceId: projectId,
  });

  const handleCreateTestRecords = async () => {
    if (user)
      await generateTestRecordsForProject({
        projectId,
        count: parseInt(generateCount),
        user,
      });
  };

  return (
    <>
      <div className="flex flex-col gap-2 justify-between">
        {DEVELOPER_MODE && canGenerateTestRecords && (
          <Card className="flex-1">
            <List className="flex flex-col gap-2 space-y-0">
              <ListItem>
                <ListLabel>Generate Test Records</ListLabel>
              </ListItem>
              <ListItem className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  value={generateCount}
                  onChange={e => setGenerateCount(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={isLoading}
                  onClick={handleCreateTestRecords}
                >
                  Generate Records
                </Button>
              </ListItem>
            </List>
          </Card>
        )}

        {canUpdateProjectDetails && (
          <Card className="flex-1">
            <List className="flex flex-col gap-2 space-y-0">
              <ListItem>
                <ListLabel>Edit {NOTEBOOK_NAME_CAPITALIZED} details</ListLabel>
              </ListItem>
              <ListItem>
                <ListDescription>
                  Update {NOTEBOOK_NAME_CAPITALIZED} title and short
                  description.
                </ListDescription>
              </ListItem>
              <ListItem>
                <EditProjectDetailsDialog />
              </ListItem>
            </List>
          </Card>
        )}

        {canEditProject && (
          <Card className="flex-1">
            <List className="flex flex-col gap-2 space-y-0">
              <ListItem>
                <ListLabel>Edit {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
              </ListItem>
              <ListItem>
                <Button
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => setEditorOpen(true)}
                >
                  Open in Editor
                </Button>
              </ListItem>
            </List>
          </Card>
        )}

        {canAddProjectToTeam && (
          <Card className="flex-1">
            <List className="flex flex-col gap-2 space-y-0">
              <ListItem>
                <ListLabel>Assign {NOTEBOOK_NAME} to a Team</ListLabel>
              </ListItem>
              <ListItem>
                <AddProjectToTeamDialog projectId={projectId} />
              </ListItem>
            </List>
          </Card>
        )}

        {canReadProjectMetadata && (
          <Card className="flex-1">
            <List className="flex flex-col gap-2 space-y-0">
              <ListItem>
                <ListLabel>Download JSON</ListLabel>
                <ListDescription>
                  Download the {NOTEBOOK_NAME} design JSON file.
                </ListDescription>
              </ListItem>
              <ListItem>
                <Button variant="outline" disabled={isLoading}>
                  <a
                    href={`data:text/json;charset=utf-8,${encodeURIComponent(
                      JSON.stringify(data?.uiSpecification ?? {}, null, 2)
                    )}`}
                    download={`${projectId}.json`}
                  >
                    Download JSON
                  </a>
                </Button>
              </ListItem>
            </List>
          </Card>
        )}

        {canEditProject && (
          <Card className="flex-1">
            <List className="flex flex-col gap-2 space-y-0">
              <ListItem>
                <ListLabel>
                  Replace {NOTEBOOK_NAME_CAPITALIZED} JSON File
                </ListLabel>
                <ListDescription>
                  Upload a JSON design file to replace the existing{' '}
                  {NOTEBOOK_NAME} design.
                </ListDescription>
              </ListItem>
              <ListItem>
                <EditProjectDialog onSuccess={uploadProjectCallback} />
              </ListItem>
            </List>
          </Card>
        )}

        {canCreateTemplateFromProject && (
          <Card className="flex-1">
            <List className="flex flex-col gap-2 space-y-0">
              <ListItem>
                <ListLabel>
                  Create Template from this {NOTEBOOK_NAME_CAPITALIZED}
                </ListLabel>
              </ListItem>
              <ListItem>
                <CreateTemplateFromProjectDialog projectId={projectId} />
              </ListItem>
            </List>
          </Card>
        )}

        {canChangeProjectStatus && (
          <Card className="flex-1">
            <ProjectStatusDialog projectId={projectId} />
          </Card>
        )}

        {canChangeArchive && (
          <Card className="flex-1">
            <List className="flex flex-col gap-2 space-y-0">
              <ListItem className="flex flex-col items-start gap-2">
                <ListLabel className="block">
                  Archive {NOTEBOOK_NAME_CAPITALIZED}
                </ListLabel>
                {!projectIsClosed && (
                  <ListDescription>
                    To archive, you must close the {NOTEBOOK_NAME} first
                  </ListDescription>
                )}
                <ArchiveProjectDialog
                  projectId={projectId}
                  disabled={!projectIsClosed}
                />
              </ListItem>
            </List>
          </Card>
        )}
      </div>
      <DesignerDialog
        open={editorOpen}
        notebook={initialNotebook}
        exportBaseName={data?.name}
        onClose={handleEditorClose}
      />
    </>
  );
};

export default ProjectActions;
