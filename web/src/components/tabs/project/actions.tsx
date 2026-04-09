import React, {useMemo, useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {
  DEVELOPER_MODE,
  NOTEBOOK_NAME,
  NOTEBOOK_NAME_CAPITALIZED,
} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useGetProject} from '@/hooks/queries';
import {Route} from '@/routes/_protected/projects/$projectId';
import {ProjectStatusDialog} from '@/components/dialogs/change-project-status-dialog';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {
  Action,
  getUserResourcesForAction,
  ProjectStatus,
} from '@faims3/data-model';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {ArchiveProjectDialog} from '@/components/dialogs/archive-project-dialog';
import {RestoreArchivedProjectDialog} from '@/components/dialogs/restore-archived-project-dialog';
import {DeleteArchivedProjectDialog} from '@/components/dialogs/delete-archived-project-dialog';
import {useQueryClient} from '@tanstack/react-query';
import {DesignerDialog} from '@/components/dialogs/designer-dialog';
import type {NotebookWithHistory} from '@/designer/state/initial';
import {EditProjectDialog} from '@/components/dialogs/edit-project-dialog';
import {generateTestRecordsForProject} from '@/hooks/project-hooks';
import {Input} from '@mui/material';
import {AddProjectToTeamDialog} from '@/components/dialogs/add-project-to-team-dialog';
import {CreateTemplateFromProjectDialog} from '@/components/dialogs/create-tempalate-from-project-dialog';
import {getArchiveProjectActionsDescription} from '@/project-archive/project-lifecycle-copy';
import {
  toDesignerNotebookWithHistory,
  useDesignerSaveMutation,
} from '@/designer/integration';

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

  const canCreateTemplateInTeam =
    getUserResourcesForAction({
      decodedToken: user?.decodedToken,
      action: Action.CREATE_TEMPLATE_IN_TEAM,
    }).length > 0;

  const isArchived =
    data?.status === ProjectStatus.ARCHIVED;
  const surveyIsClosed = data?.status === ProjectStatus.CLOSED;

  const canChangeArchive = useIsAuthorisedTo({
    action: Action.CHANGE_PROJECT_ARCHIVE_STATUS,
    resourceId: projectId,
  });

  const canDestroyProject = useIsAuthorisedTo({
    action: Action.DELETE_PROJECT,
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
        {isArchived && (
          <Alert>
            <AlertTitle>This {NOTEBOOK_NAME} is archived</AlertTitle>
            <AlertDescription>
              It is hidden from normal lists. Editing and open/close controls
              are unavailable until you restore it from the Archive section or
              from the actions below.
            </AlertDescription>
          </Alert>
        )}

        {DEVELOPER_MODE && !isArchived && (
          <Card className="flex-1">
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>Generate Test Records</ListLabel>
                <ListDescription>
                  Generate test records for this {NOTEBOOK_NAME}
                </ListDescription>
              </ListItem>
              <ListItem>
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

        {canEditProject && !isArchived && (
          <Card className="flex-1">
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>Edit {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
                <ListDescription>
                  Edit this {NOTEBOOK_NAME} in the {NOTEBOOK_NAME_CAPITALIZED}{' '}
                  Editor.
                </ListDescription>
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

        {canAddProjectToTeam && !isArchived && (
          <Card className="flex-1">
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>Assign {NOTEBOOK_NAME} to a Team</ListLabel>
                <ListDescription>
                  Assign this {NOTEBOOK_NAME} to a team.
                </ListDescription>
              </ListItem>
              <ListItem>
                <AddProjectToTeamDialog projectId={projectId} />
              </ListItem>
            </List>
          </Card>
        )}

        <Card className="flex-1">
          <List className="flex flex-col gap-4">
            <ListItem>
              <ListLabel>Download JSON</ListLabel>
              <ListDescription>
                Download the JSON file for this {NOTEBOOK_NAME_CAPITALIZED}.
              </ListDescription>
            </ListItem>
            <ListItem>
              <Button variant="outline">
                <a
                  href={`data:text/json;charset=utf-8,${encodeURIComponent(
                    JSON.stringify({
                      'ui-specification': data?.['ui-specification'],
                      metadata: data?.metadata,
                    })
                  )}`}
                  download={`${projectId}.json`}
                >
                  Download JSON
                </a>
              </Button>
            </ListItem>
          </List>
        </Card>

        {canEditProject && !isArchived && (
          <Card className="flex-1">
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>
                  Replace {NOTEBOOK_NAME_CAPITALIZED} JSON File
                </ListLabel>
                <ListDescription>
                  Replace the {NOTEBOOK_NAME} JSON file.
                </ListDescription>
              </ListItem>
              <ListItem>
                <EditProjectDialog onSuccess={uploadProjectCallback} />
              </ListItem>
            </List>
          </Card>
        )}

        {canCreateTemplateInTeam && !isArchived && (
          <Card className="flex-1">
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>
                  Create Template from this {NOTEBOOK_NAME_CAPITALIZED}
                </ListLabel>
                <ListDescription>
                  Create a new template from the current {NOTEBOOK_NAME}. You
                  will then be able to create copies of this {NOTEBOOK_NAME}{' '}
                  from the template.
                </ListDescription>
              </ListItem>
              <ListItem>
                <CreateTemplateFromProjectDialog projectId={projectId} />
              </ListItem>
            </List>
          </Card>
        )}

        {canChangeProjectStatus && !isArchived && (
          <Card className="flex-1">
            <ProjectStatusDialog projectId={projectId} />
          </Card>
        )}

        {!isArchived && canChangeArchive && (
          <Card className="flex-1">
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>Archive {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
                {surveyIsClosed ? (
                  <>
                    <ListDescription>
                      {getArchiveProjectActionsDescription()}
                    </ListDescription>
                    <ArchiveProjectDialog projectId={projectId} />
                  </>
                ) : (
                  <ListDescription>
                    Only closed {NOTEBOOK_NAME_CAPITALIZED}s can be archived. Set
                    status to closed first using the open/closed control above if
                    you have access, or ask a project administrator.
                  </ListDescription>
                )}
              </ListItem>
            </List>
          </Card>
        )}

        {isArchived && (canChangeArchive || canDestroyProject) && (
          <Card className="flex-1">
            <List className="flex flex-col gap-4">
              {canChangeArchive ? (
                <ListItem>
                  <ListLabel>Restore from archive</ListLabel>
                  <ListDescription>
                    Returns the {NOTEBOOK_NAME} to the closed state (not open for
                    new activations).
                  </ListDescription>
                  <RestoreArchivedProjectDialog projectId={projectId} />
                </ListItem>
              ) : null}
              {canDestroyProject && data?.name ? (
                <ListItem>
                  <ListLabel>Permanent deletion</ListLabel>
                  <ListDescription>
                    Destroy all server-side records and references. This cannot
                    be undone.
                  </ListDescription>
                  <DeleteArchivedProjectDialog
                    projectId={projectId}
                    surveyName={data.name}
                  />
                </ListItem>
              ) : null}
            </List>
          </Card>
        )}
      </div>
      <DesignerDialog
        open={editorOpen}
        notebook={initialNotebook}
        onClose={handleEditorClose}
      />
    </>
  );
};

export default ProjectActions;
