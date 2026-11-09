// SPDX-License-Identifier: Apache-2.0

/**
 * Shared Control Centre / Designer dialog for sending in-app feedback.
 */

import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {
  FeedbackCategory,
  FeedbackSource,
  INPUT_LIMITS,
} from '@faims3/data-model';
import {MessageSquare} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {toast} from 'sonner';
import {
  buildWebFeedbackPayload,
  FEEDBACK_OFFLINE_MESSAGE,
  FEEDBACK_SUCCESS_MESSAGE,
  postFeedback,
} from './submit-feedback';

export function FeedbackDialog({
  open,
  onOpenChange,
  source,
  token,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: FeedbackSource;
  token: string;
}) {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setMessage('');
    setCategory('');
    setError(null);
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please enter a message.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError(FEEDBACK_OFFLINE_MESSAGE);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await postFeedback({
        token,
        body: buildWebFeedbackPayload({
          message: trimmed,
          source,
          category: category || undefined,
        }),
      });
      if (result.ok) {
        toast.success(FEEDBACK_SUCCESS_MESSAGE);
        reset();
        onOpenChange(false);
        return;
      }
      setError(result.message);
    } catch {
      setError(FEEDBACK_OFFLINE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="web-feedback-dialog"
        className="z-[70]"
        overlayClassName="z-[70]"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Tell us what is working and what is not. We will email this to the
              support inbox. Do not include record data or passwords.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p
              className="mt-3 text-sm text-destructive"
              data-testid="web-feedback-error"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="mt-4 grid gap-2">
            <Label htmlFor="feedback-category">Category (optional)</Label>
            <select
              id="feedback-category"
              data-testid="web-feedback-category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={category}
              onChange={event =>
                setCategory(event.target.value as FeedbackCategory | '')
              }
            >
              <option value=""></option>
              <option value="bug">Bug</option>
              <option value="suggestion">Suggestion</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="mt-4 grid gap-2">
            <Label htmlFor="feedback-message">Message</Label>
            <Textarea
              id="feedback-message"
              data-testid="web-feedback-message"
              required
              value={message}
              maxLength={INPUT_LIMITS.LONG_TEXT_MAX_LENGTH}
              onChange={event => setMessage(event.target.value)}
              rows={6}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="web-feedback-submit"
              disabled={submitting || !message.trim()}
            >
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Header / app-bar control that opens {@link FeedbackDialog}.
 */
export function FeedbackButton({
  source,
  token,
  testId,
  label = 'Feedback',
  variant = 'outline',
}: {
  source: FeedbackSource;
  token: string;
  testId: string;
  label?: string;
  variant?: 'outline' | 'ghost';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        className="mr-2 p-2"
        data-testid={testId}
        onClick={() => setOpen(true)}
      >
        <MessageSquare />
        <span className="align-middle font-semibold">{label}</span>
      </Button>
      <FeedbackDialog
        open={open}
        onOpenChange={setOpen}
        source={source}
        token={token}
      />
    </>
  );
}
