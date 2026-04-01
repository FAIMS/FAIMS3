import {
  GetTemplateSurveyReferencesResponseSchema,
  type GetTemplateSurveyReferencesResponse,
} from '@faims3/data-model';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {useAuth} from '@/context/auth-provider';
import {
  templateDeleteDialogLabels,
  getTemplateDeleteDialogBody,
} from '@/archive/template-delete-warnings';
import {toast} from 'sonner';
import {AlertTriangle} from 'lucide-react';
import {cn} from '@/lib/utils';

type DeleteArchivedTemplateDialogProps = {
  templateId: string;
  templateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

async function fetchSurveyReferenceCount(
  templateId: string,
  token: string
): Promise<GetTemplateSurveyReferencesResponse> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/templates/${templateId}/survey-references`,
    {
      headers: {Authorization: `Bearer ${token}`},
    }
  );
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      json &&
      typeof json === 'object' &&
      json !== null &&
      'error' in json &&
      typeof (json as {error?: {message?: unknown}}).error?.message === 'string'
        ? (json as {error: {message: string}}).error.message
        : response.statusText;
    throw new Error(message);
  }
  return GetTemplateSurveyReferencesResponseSchema.parse(json);
}

async function postDeleteTemplate(
  templateId: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/templates/${templateId}/delete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (response.ok) {
    return;
  }
  const json: unknown = await response.json().catch(() => undefined);
  const message =
    json &&
    typeof json === 'object' &&
    json !== null &&
    'error' in json &&
    typeof (json as {error?: {message?: unknown}}).error?.message === 'string'
      ? (json as {error: {message: string}}).error.message
      : response.statusText;
  throw new Error(message);
}

export function DeleteArchivedTemplateDialog({
  templateId,
  templateName,
  open,
  onOpenChange,
}: DeleteArchivedTemplateDialogProps) {
  const {user} = useAuth();
  const queryClient = useQueryClient();

  const referencesQuery = useQuery({
    queryKey: ['templates', templateId, 'survey-references'],
    queryFn: async () => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      return fetchSurveyReferenceCount(templateId, user.token);
    },
    enabled: open && !!user && !!templateId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await postDeleteTemplate(templateId, user.token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['templates']});
      queryClient.invalidateQueries({queryKey: ['templates', templateId]});
      queryClient.invalidateQueries({queryKey: ['templatesbyteam']});
      toast.success('Template deleted');
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Delete failed');
    },
  });

  const surveyCount = referencesQuery.data?.surveyCount ?? null;
  const body =
    surveyCount !== null
      ? getTemplateDeleteDialogBody({
          templateName,
          referencingSurveyCount: surveyCount,
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClick={e => e.stopPropagation()}
        className="max-h-[min(90vh,40rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{templateDeleteDialogLabels.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {referencesQuery.isLoading && (
                <p>{templateDeleteDialogLabels.loadingReferences}</p>
              )}
              {referencesQuery.isError && (
                <p className="text-destructive">
                  {referencesQuery.error instanceof Error
                    ? referencesQuery.error.message
                    : templateDeleteDialogLabels.loadError}
                </p>
              )}
              {body && (
                <>
                  <p className="text-foreground leading-relaxed">
                    {body.introBefore}
                    <span
                      className={cn(
                        'mx-0.5 inline-block max-w-full align-middle rounded-md border border-border',
                        'bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground',
                        'break-words [overflow-wrap:anywhere]'
                      )}
                      title={body.nameLabel}
                    >
                      {body.nameLabel}
                    </span>
                    {body.introAfter}
                  </p>
                  {body.showStrongWarning && (
                    <Alert variant="destructive" className="w-full">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>Linked surveys</AlertTitle>
                      <AlertDescription className="mt-2 space-y-2">
                        <ul className="list-disc space-y-1 pl-4">
                          {body.bullets.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  {!body.showStrongWarning && (
                    <ul className="list-disc space-y-1 pl-4 text-foreground">
                      {body.bullets.map(line => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  <p>{body.footerNote}</p>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            {templateDeleteDialogLabels.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={
            deleteMutation.isPending ||
            referencesQuery.isLoading ||
            referencesQuery.isError ||
            surveyCount === null
            }
            onClick={() => deleteMutation.mutate()}
          >
            {templateDeleteDialogLabels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
