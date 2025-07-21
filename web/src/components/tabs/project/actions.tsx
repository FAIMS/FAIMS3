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
import {Action} from '@faims3/data-model';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {DesignerDialog} from '@/components/dialogs/designer-dialog';
import type {
  NotebookWithHistory,
  NotebookUISpec,
} from '@/designer/state/initial';
import {EditProjectDialog} from '@/components/dialogs/edit-project-dialog';
import {generateTestRecordsForProject} from '@/hooks/project-hooks';
import {Input} from '@mui/material';
import {AddProjectToTeamDialog} from '@/components/dialogs/add-project-to-team-dialog';

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
    if (!data) return undefined;
    return {
      metadata: data.metadata,
      'ui-specification': {
        present: data['ui-specification'] as unknown as NotebookUISpec,
        past: [],
        future: [],
      },
    };
  }, [data]);

  // save updated notebook JSON
  const saveFile = useMutation<unknown, Error, File>({
    mutationFn: async file => {
      const jsonText = await file.text();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user?.token}`,
          },
          body: jsonText,
        }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Save failed: ${res.status} ${err}`);
      }
      return res.json();
    },
    onSuccess: updated => {
      queryClient.setQueryData(['projects', projectId], () => updated);
      queryClient.invalidateQueries({queryKey: ['projects', projectId]});
    },
  });

  const handleEditorClose = (file?: File) => {
    if (file) saveFile.mutate(file);
    setEditorOpen(false);
  };

  const canChangeProjectStatus = useIsAuthorisedTo({
    action: Action.CHANGE_PROJECT_STATUS,
    resourceId: projectId,
  });

  // can we change the project team?
  const canAddProjectToTeam = useIsAuthorisedTo({
    action: Action.CHANGE_PROJECT_TEAM,
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
        {DEVELOPER_MODE && (
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
        <Card className="flex-1">
          <List className="flex flex-col gap-4">
            <ListItem>
              <ListLabel>Edit {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
              <ListDescription>
                Edit this {NOTEBOOK_NAME} in the Notebook Editor.
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

        {canAddProjectToTeam && (
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
              <EditProjectDialog />
            </ListItem>
          </List>
        </Card>

        {canChangeProjectStatus && (
          <Card className="flex-1">
            <ProjectStatusDialog projectId={projectId} />
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
