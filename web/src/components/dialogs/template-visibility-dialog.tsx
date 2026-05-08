import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplate} from '@/hooks/queries';
import {putTemplateSetVisibility} from '@/hooks/template-hooks';
import {useQueryClient} from '@tanstack/react-query';
import {AlertCircle, CheckCircle, Info} from 'lucide-react';
import {useState} from 'react';
import {Button} from '../ui/button';

export function TemplateVisibilityDialog({templateId}: {templateId: string}) {
  const {user} = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const {data: template} = useGetTemplate({user, templateId});
  const isPublic = template?.isPublic === true;

  const onConfirmToggle = async () => {
    if (!user) return;
    await putTemplateSetVisibility({
      user,
      templateId,
      isPublic: !isPublic,
    });
    await queryClient.invalidateQueries({queryKey: ['templates', templateId]});
    await queryClient.invalidateQueries({queryKey: ['templates', undefined]});
    setOpen(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div>
      <div className="mb-2">
        <div className="flex items-center gap-1.5 mb-2">
          <h3 className="text-base font-medium text-card-foreground">
            Template visibility
          </h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="More about template visibility"
              >
                <Info className="h-4 w-4" aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground mb-4">
                  Template visibility
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 text-left text-sm text-foreground">
                    <p>
                      <span className="font-medium text-emerald-600 dark:text-emerald-500">
                        Public:
                      </span>{' '}
                      this template will be available to view and use for all
                      users. Public permissions are read only.
                    </p>
                    <p>
                      <span className="font-medium text-muted-foreground">
                        Private:
                      </span>{' '}
                      Visible only to people with access to this template (for
                      example your team and system administrators).
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-card-foreground">
            Current status:
          </span>
          {isPublic ? (
            <div className="flex items-center gap-1.5 text-emerald-500">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">Public</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">Private</span>
            </div>
          )}
        </div>
      </div>

      {isPublic ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              Make private
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Make template private
              </DialogTitle>
              <DialogDescription className="text-foreground">
                This template will no longer appear in the available templates
                list for all users. People who already have access (for example
                your team and system administrators) will still see it.
              </DialogDescription>
            </DialogHeader>
            <Button variant="default" onClick={onConfirmToggle}>
              Yes, make private
            </Button>
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              Make public
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Make template public
              </DialogTitle>
              <DialogDescription asChild>
                <p className="text-left text-sm text-foreground">
                  This template will be available to view and use for all users.
                  Public permissions are read only.
                </p>
              </DialogDescription>
            </DialogHeader>
            <Button variant="default" onClick={onConfirmToggle}>
              Yes, make public
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
