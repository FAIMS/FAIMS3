// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: FeedbackDialog.tsx
 * Description:
 *   MUI dialog for sending in-app feedback from the data-collection app.
 *   Offline: no queue — show that a connection is required and leave the text.
 */

import {Feedback as FeedbackIcon} from '@mui/icons-material';
import {Alert, TextField} from '@mui/material';
import {FeedbackCategory, INPUT_LIMITS} from '@faims3/data-model';
import React, {useState} from 'react';
import {addAlert} from '../../../context/slices/alertSlice';
import {useAppDispatch} from '../../../context/store';
import FaimsDialog from '../ui/Faims_Dialog';
import {
  buildAppFeedbackPayload,
  FEEDBACK_OFFLINE_MESSAGE,
  FEEDBACK_SUCCESS_MESSAGE,
  postFeedback,
} from './submitFeedback';

export default function FeedbackDialog({
  open,
  onClose,
  conductorUrl,
  token,
}: {
  open: boolean;
  onClose: () => void;
  conductorUrl: string;
  token: string;
}) {
  const dispatch = useAppDispatch();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetAndClose = () => {
    setMessage('');
    setCategory('');
    setError(null);
    setSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
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
        conductorUrl,
        token,
        body: buildAppFeedbackPayload({
          message: trimmed,
          source: 'app',
          category: category || undefined,
        }),
      });
      if (result.ok) {
        dispatch(
          addAlert({
            message: FEEDBACK_SUCCESS_MESSAGE,
            severity: 'success',
          })
        );
        resetAndClose();
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
    <FaimsDialog
      open={open}
      title="Send feedback"
      icon={<FeedbackIcon />}
      onClose={resetAndClose}
      onPrimaryAction={handleSubmit}
      primaryActionText="Send"
      primaryActionLoading={submitting}
      primaryActionDisabled={!message.trim()}
      primaryActionTestId="app-feedback-submit"
      cancelTestId="app-feedback-cancel"
    >
      {error && (
        <Alert severity="error" sx={{mb: 2}} data-testid="app-feedback-error">
          {error}
        </Alert>
      )}
      <TextField
        select
        label="Category (optional)"
        value={category}
        onChange={event =>
          setCategory(event.target.value as FeedbackCategory | '')
        }
        fullWidth
        sx={{mb: 2}}
        slotProps={{
          select: {native: true},
          htmlInput: {'data-testid': 'app-feedback-category'},
        }}
      >
        <option value=""></option>
        <option value="bug">Bug</option>
        <option value="suggestion">Suggestion</option>
        <option value="other">Other</option>
      </TextField>
      <TextField
        required
        multiline
        minRows={4}
        fullWidth
        label="Message"
        value={message}
        onChange={event => setMessage(event.target.value)}
        slotProps={{
          htmlInput: {
            maxLength: INPUT_LIMITS.LONG_TEXT_MAX_LENGTH,
            'data-testid': 'app-feedback-message',
          },
        }}
      />
    </FaimsDialog>
  );
}
