import {useState} from 'react';
import {Check, Clipboard} from 'lucide-react';
import {Button} from './button';

/**
 * Subtle table-cell control to copy an invite URL to the clipboard.
 */
export function CopyInviteLink({url}: {url: string}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          Copied
          <Check className="h-4 w-4" />
        </>
      ) : (
        <>
          Copy link
          <Clipboard className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}
