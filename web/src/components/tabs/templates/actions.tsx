import React, {useState, useMemo} from 'react';
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
import {DesignerWidget} from '@/designer/src/DesignerWidget';
import type {
  NotebookWithHistory,
  NotebookUISpec,
} from '@/designer/src/state/initial';

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
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const saveFile = useMutation<unknown, Error, File>({
    mutationFn: async file => {
      console.log('Saving template', file);

      if (!user) throw new Error('Not authenticated');

      const jsonText = await file.text();

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/templates/${templateId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: jsonText,
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed: ${res.status} ${text}`);
      }

      return res.json();
    },
    onSuccess: updatedTemplate => {
      queryClient.setQueryData(
        ['templates', templateId],
        () => updatedTemplate
      );

      queryClient.invalidateQueries({queryKey: ['templates', templateId]});

      setEditing(false);
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

  const archived = data?.metadata.project_status === 'archived';

  const handleDesignerClose = (file: File | undefined) => {
    if (!file) {
      setEditing(false);
      return;
    }
    saveFile.mutate(file);
    setEditing(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                onClick={() => setEditing(true)}
              >
                Open in Editor
              </Button>
            </ListItem>
          </List>
        </Card>
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
        <Card>
          <List>
            {archived ? (
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
            <ArchiveTemplateDialog archived={archived} />
          </List>
        </Card>
      </div>

      {editing && initialNotebook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20"
          onClick={() => setEditing(false)}
        >
          <div
            className="bg-white w-[95vw] h-[95vh] rounded-lg overflow-hidden shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <DesignerWidget
              notebook={initialNotebook}
              onClose={handleDesignerClose}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default TemplateActions;
