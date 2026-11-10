// SPDX-License-Identifier: Apache-2.0
import React, {useMemo, useState} from 'react';
import {ArchiveTemplateDialog} from '@/components/dialogs/archive-template-dialog';
import {TemplateVisibilityDialog} from '@/components/dialogs/template-visibility-dialog';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {config} from '@/constants';
import {ProjectFromTemplateDialog} from '@/components/dialogs/project-from-template';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {useGetTemplate} from '@/hooks/queries';
import {Route} from '@/routes/_protected/templates/$templateId';
import {useQueryClient} from '@tanstack/react-query';
import {DesignerDialog} from '@/components/dialogs/designer-dialog';
import {ActionsGrid} from '@/components/tabs/actions-grid';
import type {NotebookWithHistory} from '@/designer/state/initial';
import {EditTemplateDialog} from '@/components/dialogs/edit-template';
import {EditTemplateDetailsDialog} from '@/components/dialogs/edit-template-details-dialog';
import {Action, getUserResourcesForAction} from '@faims3/data-model';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {AddTemplateToTeamDialog} from '@/components/dialogs/add-template-to-team-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  toDesignerNotebookWithHistory,
  useDesignerSaveMutation,
} from '@/designer/integration';
import {Spinner} from '@/components/ui/spinner';

/**
 * TemplateActions component renders action cards for creating a project from a template,
 * editing the template, and archiving the template.
 *
 * @param {string} templateId - The unique identifier of the template.
 * @returns {JSX.Element} The rendered TemplateActions component.
 */
const TemplateActions = () => {
  const user = useRequiredUser();
  const {templateId} = Route.useParams();
  const {data, isLoading} = useGetTemplate({user, templateId});
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);

  // PUT template notebook JSON from the designer; react-query updates cache on success.
  const saveTemplateNotebook = useDesignerSaveMutation({
    resourceType: 'templates',
    apiResourceType: 'templates',
    resourceId: templateId,
    token: user.token,
  });

  const initialNotebook = useMemo<NotebookWithHistory | undefined>(() => {
    return toDesignerNotebookWithHistory(data, 'template');
  }, [data]);

  const handleEditorClose = (file?: File) => {
    if (file) saveTemplateNotebook.mutateAsyncWithToast(file);
    setEditorOpen(false);
  };

  // Invalidate template query after notebook file upload from elsewhere in the UI.
  const uploadTemplateCallback = () => {
    queryClient.invalidateQueries({queryKey: ['templates', templateId]});
  };

  const canUpdateTemplateDetails = useIsAuthorisedTo({
    action: Action.UPDATE_TEMPLATE_DETAILS,
    resourceId: templateId,
  });

  const canEditTemplate = useIsAuthorisedTo({
    action: Action.UPDATE_TEMPLATE_UISPEC,
    resourceId: templateId,
  });

  const canChangeTemplateArchiveStatus = useIsAuthorisedTo({
    action: Action.CHANGE_TEMPLATE_STATUS,
    resourceId: templateId,
  });

  const canChangeTemplateVisibility = useIsAuthorisedTo({
    action: Action.CHANGE_TEMPLATE_VISIBILITY,
    resourceId: templateId,
  });

  const canCreateProject = useIsAuthorisedTo({
    action: Action.CREATE_PROJECT,
  });

  const canAssignTemplateToTeam = useIsAuthorisedTo({
    action: Action.CHANGE_TEMPLATE_TEAM,
    resourceId: templateId,
  });

  const canReadTemplateDetails = useIsAuthorisedTo({
    action: Action.READ_TEMPLATE_DETAILS,
    resourceId: templateId,
  });

  /** Matches create-from-template form: global create or team-scoped create on any team. */
  const canCreateProjectFromTemplate =
    canCreateProject ||
    getUserResourcesForAction({
      decodedToken: user.decodedToken,
      action: Action.CREATE_PROJECT_IN_TEAM,
    }).length > 0;

  const archived = data?.archived === true;

  // Prevent reopening the editor while the latest design is still saving.
  const isTemplateNotebookSaving = saveTemplateNotebook.isPending;

  return (
    <>
      <ActionsGrid>
        {canEditTemplate && (
          <Card>
            <List>
              <ListItem>
                <ListLabel>Edit Template in Designer</ListLabel>
                <ListDescription>
                  Open the Designer to change this template.
                </ListDescription>
              </ListItem>
              <ListItem>
                {archived ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block w-fit">
                          <Button variant="outline" disabled>
                            Open in Designer
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-balance">
                        Archived templates cannot be opened in the editor.
                        Un-archive the template first.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    variant="outline"
                    disabled={
                      isLoading || !initialNotebook || isTemplateNotebookSaving
                    }
                    onClick={() => setEditorOpen(true)}
                  >
                    {isTemplateNotebookSaving ? (
                      <span className="flex items-center gap-2">
                        <Spinner className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Open in Designer'
                    )}
                  </Button>
                )}
              </ListItem>
            </List>
          </Card>
        )}

        {canCreateProjectFromTemplate && (
          <Card>
            <List>
              <ListItem>
                <ListLabel>Create {config.notebookNameCapitalized}</ListLabel>
                <ListDescription>
                  Create a new {config.notebookName} based on this template.
                </ListDescription>
              </ListItem>
              <ListItem>
                <ProjectFromTemplateDialog />
              </ListItem>
            </List>
          </Card>
        )}

        {canUpdateTemplateDetails && (
          <Card>
            <List>
              <ListItem>
                <ListLabel>Edit Template details</ListLabel>
                <ListDescription>
                  Update template title and short description.
                </ListDescription>
              </ListItem>
              <ListItem>
                <EditTemplateDetailsDialog />
              </ListItem>
            </List>
          </Card>
        )}

        {canAssignTemplateToTeam && (
          <Card>
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>Assign Template to Team</ListLabel>
                <ListDescription>
                  Assign this template to a team so its members can use it.
                </ListDescription>
              </ListItem>
              <ListItem>
                <AddTemplateToTeamDialog
                  templateId={templateId}
                  disabled={archived}
                />
              </ListItem>
            </List>
          </Card>
        )}

        {canReadTemplateDetails && (
          <Card>
            <List>
              <ListItem>
                <ListLabel>Download JSON</ListLabel>
                <ListDescription>
                  Download the template design as JSON (metadata and uiSpec).
                </ListDescription>
              </ListItem>
              <ListItem>
                <Button variant="outline" disabled={isLoading}>
                  <a
                    href={`data:text/json;charset=utf-8,${encodeURIComponent(
                      JSON.stringify(data?.uiSpecification ?? {}, null, 2)
                    )}`}
                    download={`${templateId}.json`}
                  >
                    Download JSON
                  </a>
                </Button>
              </ListItem>
            </List>
          </Card>
        )}
        {canEditTemplate && (
          <Card>
            <List className="flex flex-col gap-4">
              <ListItem>
                <ListLabel>Replace Template JSON File</ListLabel>
                <ListDescription>
                  Upload a JSON design file to replace the existing template
                  design.
                </ListDescription>
              </ListItem>
              <ListItem>
                <EditTemplateDialog onSuccess={uploadTemplateCallback} />
              </ListItem>
            </List>
          </Card>
        )}
        {canChangeTemplateVisibility && (
          <Card>
            <TemplateVisibilityDialog templateId={templateId} />
          </Card>
        )}
        {canChangeTemplateArchiveStatus ? (
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
                  <ListDescription>
                    Archive the current template.
                  </ListDescription>
                </ListItem>
              )}
              <ArchiveTemplateDialog archived={data?.archived === true} />
            </List>
          </Card>
        ) : null}
      </ActionsGrid>
      <DesignerDialog
        open={editorOpen && !archived}
        notebook={initialNotebook}
        exportBaseName={data?.name}
        onClose={handleEditorClose}
        designerMode="template"
      />
    </>
  );
};

export default TemplateActions;
