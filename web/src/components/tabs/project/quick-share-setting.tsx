// SPDX-License-Identifier: Apache-2.0
import {Card} from '@/components/ui/card';
import {Label} from '@/components/ui/label';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {Switch} from '@/components/ui/switch';
import {config} from '@/constants';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {
  errorMessageFromNotebookJsonBody,
  updateNotebookMetadataRequest,
} from '@/hooks/project-hooks';
import {useGetProject} from '@/hooks/queries';
import {Route} from '@/routes/_protected/projects/$projectId';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';

/**
 * Actions-tab control for the survey `disableQuickShare` flag
 * (PUT /api/notebooks/:id metadata).
 */
export function ProjectQuickShareSetting() {
  const user = useRequiredUser();
  const {projectId} = Route.useParams();
  const {data, isLoading} = useGetProject({user, projectId});
  const queryClient = useQueryClient();

  const notebookName = config.notebookName;
  const quickShareEnabled = data?.disableQuickShare !== true;

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await updateNotebookMetadataRequest({
        user,
        projectId,
        disableQuickShare: !enabled,
      });
      if (!response.ok) {
        const json: unknown = await response.json().catch(() => undefined);
        throw new Error(
          errorMessageFromNotebookJsonBody(json, response.statusText)
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: ['projects', projectId]});
      await queryClient.invalidateQueries({queryKey: ['projects']});
      await queryClient.invalidateQueries({queryKey: ['projectsbyteam']});
    },
  });

  const handleCheckedChange = (enabled: boolean) => {
    void toast.promise(mutation.mutateAsync(enabled), {
      loading: 'Saving quick share...',
      success: 'Quick share saved.',
      error: (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : 'No error message provided';
        return {
          message: 'Quick share save failed',
          description: `${errorMessage}. Your change was not saved.`,
        };
      },
    });
  };

  return (
    <Card className="flex-1" data-testid="web-project-quick-share">
      <List className="flex flex-col gap-2 space-y-0">
        <ListItem>
          <ListLabel>Quick share</ListLabel>
        </ListItem>
        <ListItem>
          <ListDescription>
            When enabled, people who already have this {notebookName} on their
            device can generate a temporary QR code that grants another person
            access at a chosen level (subject to their permissions). Disable
            this if you only want people invited from Control Centre.
          </ListDescription>
        </ListItem>
        <ListItem className="flex items-center gap-3">
          <Switch
            id="web-project-quick-share-enabled"
            checked={quickShareEnabled}
            disabled={isLoading || !data || mutation.isPending}
            onCheckedChange={handleCheckedChange}
            data-testid="web-project-quick-share-toggle"
          />
          <Label
            htmlFor="web-project-quick-share-enabled"
            className="cursor-pointer"
          >
            {quickShareEnabled ? 'Enabled' : 'Disabled'}
          </Label>
        </ListItem>
      </List>
    </Card>
  );
}
