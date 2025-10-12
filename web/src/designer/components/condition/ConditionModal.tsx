// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law-abiding by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
} from '@mui/material';
import {useCallback, useEffect, useState} from 'react';
import {ConditionControl} from './ConditionControl';
import {ConditionProps, ConditionType} from './types';
import QuizIcon from '@mui/icons-material/Quiz';

export const ConditionModal = (props: ConditionProps & {label: string}) => {
  const [open, setOpen] = useState(false);
  // Local draft copy
  const [draft, setDraft] = useState<ConditionType | null>(
    props.initial ?? null
  );

  // Reset the draft whenever the parent value changes while closed
  // Doing it this way because the modal exists even when closed
  useEffect(() => {
    if (!open) setDraft(props.initial ?? null);
  }, [props.initial, open]);

  // Open the dialog and refresh draft from parent prop
  const handleOpen = () => {
    setDraft(props.initial ?? null);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const [confirmCancel, setConfirmCancel] = useState(false);

  // Warn when cancelling
  const handleCancel = useCallback(() => {
    const changed =
      JSON.stringify(draft) !== JSON.stringify(props.initial || null);
    if (changed) setConfirmCancel(true);
    else close();
  }, [draft, props.initial]);

  const handleCancelConfirm = () => {
    setConfirmCancel(false);
    close();
  };

  // Commit draft
  const handleSave = () => {
    if (props.onChange) props.onChange(draft);
    close();
  };

  return (
    <>
      <Button onClick={handleOpen} size="small" startIcon={<QuizIcon />}>
        {props.label}
      </Button>

      <Dialog open={open} fullWidth={true} maxWidth="lg" onClose={handleCancel}>
        <DialogContent>
          <ConditionControl
            initial={draft}
            onChange={setDraft}
            field={props.field}
            view={props.view}
          />
        </DialogContent>

        <DialogActions>
          {confirmCancel && (
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={() => setConfirmCancel(false)}
              >
                Continue Editing
              </Button>
              <Button
                color="warning"
                variant="contained"
                onClick={handleCancelConfirm}
              >
                Confirm discard changes
              </Button>
            </Stack>
          )}
          {!confirmCancel && (
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" onClick={handleCancel}>
                Cancel Edit
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={draft === null}
              >
                Save Changes
              </Button>
            </Stack>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};
