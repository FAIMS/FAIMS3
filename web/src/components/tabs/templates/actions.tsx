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
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {DesignerDialog} from '@/components/dialogs/designer-dialog';
import type {
  NotebookWithHistory,
  NotebookUISpec,
} from '@/designer/state/initial';
import {EditTemplateDialog} from '@/components/dialogs/edit-template';
import {Action, getUserResourcesForAction} from '@faims3/data-model';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';

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
  const {data, isLoading} = useGetTemplate(user, templateId);
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);

  const saveFile = useMutation<unknown, Error, File>({
    mutationFn: async file => {
      const jsonText = await file.text();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/templates/${templateId}`,
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
      queryClient.setQueryData(['templates', templateId], () => updated);
      queryClient.invalidateQueries({
        queryKey: ['templates', templateId],
      });
    },
  });

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

  const handleEditorClose = (file?: File) => {
    if (file) saveFile.mutate(file);
    setEditorOpen(false);
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
                <ListDescription>Replace the template JSON file.</ListDescription>
              </ListItem>
              <ListItem>
                <EditTemplateDialog />
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
            {data?.metadata.project_status === 'archived' ? (
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
            <ArchiveTemplateDialog
              archived={data?.metadata.project_status === 'archived'}
            />
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
