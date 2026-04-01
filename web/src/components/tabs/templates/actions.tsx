import React, {useMemo, useState} from 'react';
import {ArchiveTemplateDialog} from '@/components/dialogs/archive-template-dialog';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {ProjectFromTemplateDialog} from '@/components/dialogs/project-from-template';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplate} from '@/hooks/queries';
import {Route} from '@/routes/_protected/templates/$templateId';
import {useQueryClient} from '@tanstack/react-query';
import {DesignerDialog} from '@/components/dialogs/designer-dialog';
import type {NotebookWithHistory} from '@/designer/state/initial';
import {EditTemplateDialog} from '@/components/dialogs/edit-template';
import {Action, getUserResourcesForAction} from '@faims3/data-model';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {AddTemplateToTeamDialog} from '@/components/dialogs/add-template-to-team-dialog';
import {
  toDesignerNotebookWithHistory,
  useDesignerSaveMutation,
} from '@/designer/integration';

/**
 * TemplateActions component renders action cards for creating a project from a template,
 * editing the template, and archiving the template.
 *
 * @param {string} templateId - The unique identifier of the template.
 * @returns {JSX.Element} The rendered TemplateActions component.
 */
const TemplateActions = () => {
  const {user} = useAuth();
  const {templateId} = Route.useParams();
  const {data, isLoading} = useGetTemplate({user, templateId});
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);

  // PUT template notebook JSON from the designer; react-query updates cache on success.
  const saveTemplateNotebook = useDesignerSaveMutation({
    resourceType: 'templates',
    apiResourceType: 'templates',
    resourceId: templateId,
    token: user?.token,
  });

  const initialNotebook = useMemo<NotebookWithHistory | undefined>(() => {
    return toDesignerNotebookWithHistory(data);
  }, [data]);

  const handleEditorClose = (file?: File) => {
    if (file) saveTemplateNotebook.mutate(file);
    setEditorOpen(false);
  };

  // Invalidate template query after notebook file upload from elsewhere in the UI.
  const uploadTemplateCallback = () => {
    queryClient.invalidateQueries({queryKey: ['templates', templateId]});
  };

  const canEditTemplate = useIsAuthorisedTo({
    action: Action.UPDATE_TEMPLATE_UISPEC,
    resourceId: templateId,
  });

  const canCreateProject = useIsAuthorisedTo({
    action: Action.CREATE_PROJECT,
  });

  const canCreateProjectInTeam =
    getUserResourcesForAction({
      decodedToken: user?.decodedToken,
      action: Action.CREATE_PROJECT_IN_TEAM,
    }).length > 0;

  // per-team and global permissions for adding templates to a team
  const canAddTemplateToTeam =
    getUserResourcesForAction({
      decodedToken: user?.decodedToken,
      action: Action.CREATE_TEMPLATE_IN_TEAM,
    }).length > 0;

  const globalCanAddTemplateToTeam = useIsAuthorisedTo({
    action: Action.CREATE_TEMPLATE,
  });

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {canEditTemplate && (
          <Card>
            <List>
              <ListItem>
                <ListLabel>Edit Template</ListLabel>
                <ListDescription>
                  Edit this template in the Notebook Editor.
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

        {(canAddTemplateToTeam || globalCanAddTemplateToTeam) && (
          <Card className="flex-1">
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>Assign {NOTEBOOK_NAME} to a Team</ListLabel>
                <ListDescription>
                  Assign this {NOTEBOOK_NAME} to a team.
                </ListDescription>
              </ListItem>
              <ListItem>
                <AddTemplateToTeamDialog templateId={templateId} />
              </ListItem>
            </List>
          </Card>
        )}

        <Card>
          <List>
            <ListItem>
              <ListLabel>Download JSON</ListLabel>
              <ListDescription>
                Download the JSON file for this template.
              </ListDescription>
            </ListItem>
            <ListItem>
              <Button variant="outline" disabled={isLoading}>
                <a
                  href={`data:text/json;charset=utf-8,${encodeURIComponent(
                    JSON.stringify({
                      metadata: data?.metadata,
                      'ui-specification': data?.['ui-specification'],
                    })
                  )}`}
                  download={`${templateId}.json`}
                >
                  Download JSON
                </a>
              </Button>
            </ListItem>
          </List>
        </Card>
        {canEditTemplate && (
          <Card className="flex-1">
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>Replace Template JSON File</ListLabel>
                <ListDescription>
                  Replace the template JSON file.
                </ListDescription>
              </ListItem>
              <ListItem>
                <EditTemplateDialog onSuccess={uploadTemplateCallback} />
              </ListItem>
            </List>
          </Card>
        )}
        {(canCreateProject || canCreateProjectInTeam) && (
          <Card>
            <List>
              <ListItem>
                <ListLabel>Create {NOTEBOOK_NAME_CAPITALIZED}</ListLabel>
                <ListDescription>
                  Create a new {NOTEBOOK_NAME} based on this template.
                </ListDescription>
              </ListItem>
              <ListItem>
                <ProjectFromTemplateDialog />
              </ListItem>
            </List>
          </Card>
        )}
        <Card>
          <List>
            {data?.archived === true ? (
              <ListItem>
                <ListLabel>Un-archive Template</ListLabel>
                <ListDescription>
                  Un-archive the current template.
                </ListDescription>
              </ListItem>
            ) : (
              <ListItem>
                <ListLabel>Archive Template</ListLabel>
                <ListDescription>Archive the current template.</ListDescription>
              </ListItem>
            )}
            <ArchiveTemplateDialog archived={data?.archived === true} />
          </List>
        </Card>
      </div>
      <DesignerDialog
        open={editorOpen}
        notebook={initialNotebook}
        onClose={handleEditorClose}
      />
    </>
  );
};

export default TemplateActions;
