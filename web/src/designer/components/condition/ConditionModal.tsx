// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Modal entry point for editing a visibility condition with save/cancel.
 */

import QuizIcon from '@mui/icons-material/Quiz';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  SxProps,
  Theme,
  Typography,
} from '@mui/material';
import type {ReactNode} from 'react';
import {useCallback, useState} from 'react';
import {ConditionType} from '../../types/condition';
import {
  designerCancelButtonSx,
  designerDialogContentSx,
} from '../designer-style';
import {ConditionControl, ConditionControlProps} from './ConditionControl';
import {normaliseConditionForCompare} from '@/lib/conditionUtils';
import {useConditionRuleFieldContext} from '@/hooks/use-condition-field-context';

/**
 * Message shown when there are not enough fields/sections to build a condition.
 */
const NoConditionFieldsMessage = (props: {view?: string}) => (
  <Typography variant="body2" color="error">
    {props.view ? (
      <>
        This form has only one section. Adding conditions for a section requires
        more than one section so that fields from other sections can be
        referenced.
      </>
    ) : (
      <>
        This form only has one field. Please add fields to this form to enable
        adding conditions.
      </>
    )}
  </Typography>
);

/** Dialog wrapper around {@link ConditionControl} with local draft until user saves. */
export const ConditionModal = (
  props: ConditionControlProps & {
    label: string;
    icon?: ReactNode;
    buttonSx?: SxProps<Theme>;
  }
) => {
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Local draft copy
  const [draft, setDraft] = useState<ConditionType | null>(
    props.initial ?? null
  );

  const {selectableFieldCount} = useConditionRuleFieldContext({
    field: props.field,
    view: props.view,
  });
  // If there are no fields to select, show a message instead of the editor.
  const canEditCondition = selectableFieldCount > 0;

  // Open the dialog, refresh draft when opening
  // Reset confirmCancel when opening/closing.
  const handleOpen = () => {
    setConfirmCancel(false);
    setDraft(props.initial ?? null);
    setOpen(true);
  };

  // clear local draft when closing
  const close = () => {
    setOpen(false);
    setConfirmCancel(false);
    setDraft(null);
  };

  // Warn when cancelling
  const handleCancel = useCallback(() => {
    const currentDraft = normaliseConditionForCompare(draft);
    const initialCondition = normaliseConditionForCompare(props.initial);

    const hasUnsavedChanges =
      JSON.stringify(currentDraft) !== JSON.stringify(initialCondition);

    if (hasUnsavedChanges) setConfirmCancel(true);
    else close();
  }, [draft, props.initial]);

  const handleCancelConfirm = () => {
    close();
  };

  // Commit draft
  const handleSave = () => {
    if (props.onChange) props.onChange(draft);
    close();
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        size="small"
        startIcon={props.icon ?? <QuizIcon />}
        sx={props.buttonSx}
      >
        {props.label}
      </Button>

      <Dialog open={open} fullWidth={true} maxWidth="lg" onClose={handleCancel}>
        <DialogContent sx={designerDialogContentSx}>
          {canEditCondition ? (
            <ConditionControl
              initial={draft}
              onChange={setDraft}
              field={props.field}
              view={props.view}
            />
          ) : (
            <NoConditionFieldsMessage view={props.view} />
          )}
        </DialogContent>

        <DialogActions>
          {confirmCancel && (
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                sx={designerCancelButtonSx}
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
              <Button
                variant="outlined"
                sx={designerCancelButtonSx}
                onClick={handleCancel}
              >
                Cancel Edit
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!canEditCondition}
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
