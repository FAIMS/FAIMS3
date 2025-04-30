/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: formButton.tsx
 * Description:
 *   Form Button:
 *  - Continue
 *  - Publish and continue editing(TBD)
 *  - Publish and Close Record(TBD)
 */

import {ProjectUIModel} from '@faims3/data-model';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  Box,
  Button,
  Grid,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import {useState} from 'react';
import {ConfirmCancelDialog} from './confirmExitDialog';
import {CustomMobileStepper} from './recordStepper';

interface FormProps {
  isSubmitting: boolean;
}
export type CloseOptionType = 'close' | 'new' | 'cancel';

interface FormSubmitButtonProps {
  /** Whether this is the final view in a multi-step form */
  is_final_view?: boolean;
  /** Disables the button when true */
  disabled?: boolean;
  /** Form state containing submission status */
  formProps: FormProps;
  /** Callback for form submission */
  handleFormSubmit: (closeType: CloseOptionType) => void;
  /** Determines if form should close or create new after submission */
  action: CloseOptionType;
  /** Button text */
  text: string;
  /** Button color variant */
  color?: 'primary' | 'secondary' | 'warning';
  /** Test ID for the button */
  'data-testid'?: string;
}

interface FormButtonGroupProps {
  /** Type of record being created/edited */
  record_type: string | null;
  /** Whether this is the final view in multi-step form */
  is_final_view: boolean;
  /** Callback for stepper navigation */
  onChangeStepper: (viewName: string, activeStepIndex: number) => void;
  /** Current view index in multi-step form */
  view_index: number;
  /** Form state containing submission status */
  formProps: FormProps;
  /** Callback for form submission */
  handleFormSubmit: (closeType: CloseOptionType) => void;
  /** Array of form views for stepper */
  views: Array<any>;
  /** UI configuration object */
  ui_specification: ProjectUIModel;
  /** Layout type */
  layout?: string;

  visitedSteps: Set<string>;
  isRecordSubmitted: boolean;

  /** when should we show the publish button? */
  publishButtonBehaviour: 'always' | 'visited' | 'noErrors';
  /** should we show the publish button(s) */
  showPublishButton: boolean;
}

/**
 * Button component for form submission with loading state
 */
function FormSubmitButton({
  is_final_view,
  disabled,
  formProps,
  handleFormSubmit,
  action,
  text,
  color,
  'data-testid': dataTestId,
}: FormSubmitButtonProps) {
  return (
    <Button
      type="button"
      fullWidth
      data-testid={dataTestId}
      color={formProps.isSubmitting ? undefined : color}
      variant={is_final_view && action !== 'new' ? 'contained' : 'outlined'}
      disableElevation
      disabled={disabled || formProps.isSubmitting}
      onClick={() => handleFormSubmit(action)}
    >
      {formProps.isSubmitting ? 'Working...' : text}
      {formProps.isSubmitting && (
        <CircularProgress
          size={24}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -12,
            marginLeft: -12,
          }}
        />
      )}
    </Button>
  );
}

/**
 * Button group for form actions including stepper navigation and submission
 * Displays two buttons stacked vertically with a help icon centered on the right
 */
export default function FormButtonGroup({
  record_type,
  is_final_view,
  onChangeStepper,
  view_index,
  formProps,
  handleFormSubmit,
  visitedSteps,
  views,
  ui_specification,
  layout,
  publishButtonBehaviour,
  showPublishButton,
}: FormButtonGroupProps) {
  const [tooltipOpen, setTooltipOpen] = useState<boolean>(false);
  const [openCancelDialog, setOpenCancelDialog] = useState(false);

  /**
   * Tooltip content explaining the publish action
   */
  const tooltipContent = (
    <div>
      <Box sx={{fontWeight: 'bold', marginBottom: 1}}>
        What does finish mean?
      </Box>
      <Typography variant="body1">
        Your response is being saved automatically as a draft. When you click
        finish, your response will be uploaded once your device has an internet
        connection.
      </Typography>
      {!showPublishButton && publishButtonBehaviour === 'noErrors' && (
        <Typography variant="body1">
          You cannot finish this record because there are errors in the form.
        </Typography>
      )}
      {!showPublishButton && publishButtonBehaviour === 'visited' && (
        <Typography variant="body1">
          You cannot finish this record because you have not visited all pages
          of the form.
        </Typography>
      )}
      <Typography variant="body1">
        The <b>Cancel</b> button will discard your current changes.
      </Typography>
    </div>
  );

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
      {views.length > 1 && layout !== 'inline' && (
        <CustomMobileStepper
          views={views}
          view_index={view_index}
          onChangeStepper={onChangeStepper}
          ui_specification={ui_specification}
          visitedSteps={visitedSteps || new Set()}
        />
      )}
      <Grid container spacing={2}>
        <Grid item xs={10.5}>
          <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
            <FormSubmitButton
              color="primary"
              data-testid="finish-close-record"
              disabled={!showPublishButton}
              formProps={formProps}
              text={`Finish and close ${record_type}`}
              action="close"
              handleFormSubmit={handleFormSubmit}
              is_final_view={is_final_view}
            />
            <FormSubmitButton
              color="secondary"
              disabled={!showPublishButton}
              formProps={formProps}
              text={`Finish and new ${record_type}`}
              action="new"
              handleFormSubmit={handleFormSubmit}
              is_final_view={is_final_view}
            />

            <FormSubmitButton
              color="warning"
              formProps={formProps}
              text={'Cancel'}
              action="cancel"
              handleFormSubmit={() => setOpenCancelDialog(true)}
              is_final_view={is_final_view}
            />
          </Box>
        </Grid>
        <ConfirmCancelDialog
          open={openCancelDialog}
          setOpen={setOpenCancelDialog}
          confirmAction={handleFormSubmit}
        />
        <Grid
          item
          xs={1.5}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Tooltip
            open={tooltipOpen}
            onClose={() => setTooltipOpen(false)}
            enterTouchDelay={0}
            leaveTouchDelay={5000}
            title={tooltipContent}
            arrow
            PopperProps={{
              sx: {
                '& .MuiTooltip-tooltip': {
                  maxWidth: 300,
                  padding: 2,
                  fontSize: '0.875rem',
                },
              },
            }}
          >
            <IconButton
              size="medium"
              onClick={e => {
                e.stopPropagation();
                setTooltipOpen(!tooltipOpen);
              }}
              sx={{
                touchAction: 'none',
              }}
            >
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
        </Grid>
      </Grid>
    </Box>
  );
}
