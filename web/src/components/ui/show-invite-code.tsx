import {useState} from 'react';
import {AlertTriangle, CheckCircle, Copy, KeyRound} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {Button} from './button';

/**
 * Advanced disclosure for an invite's raw code. Opens a dialog with a warning
 * and copy-to-clipboard control. Prefer sharing QR codes or invite links.
 */
export function ShowInviteCode({code}: {code: string}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite code:', err);
    }
  };

  return (
    <Dialog
      onOpenChange={open => {
        if (!open) setCopied(false);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          Show code
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite code</DialogTitle>
          <DialogDescription>
            Prefer sharing the QR code or invite link. Use this code only when
            those options are not available.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Handle with care</AlertTitle>
          <AlertDescription>
            Anyone with this code can redeem the invite. Share it only with
            intended recipients, and prefer the QR code or link whenever
            possible.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm font-medium">Invite code</label>
          <div className="flex gap-2">
            <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all border overflow-hidden">
              <div className="whitespace-pre-wrap break-all">{code}</div>
            </div>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
