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

import {Box, Button, Tooltip, IconButton, Grid} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CircularProgress from '@mui/material/CircularProgress';
import {CustomMobileStepper} from './recordStepper';
import {ProjectUIModel} from '@faims3/data-model';
import {useState} from 'react';

interface FormProps {
  isSubmitting: boolean;
}

interface FormSubmitButtonProps {
  /** Whether this is the final view in a multi-step form */
  is_final_view?: boolean;
  /** Disables the button when true */
  disabled?: boolean;
  /** Form state containing submission status */
  formProps: FormProps;
  /** Callback for form submission */
  handleFormSubmit: (closeType: 'close' | 'new') => void;
  /** Determines if form should close or create new after submission */
  is_close: 'close' | 'new';
  /** Button text */
  text: string;
  /** Button color variant */
  color?: 'primary' | 'secondary';
  /** Test ID for the button */
  'data-testid'?: string;
}

interface FormButtonGroupProps {
  /** Type of record being created/edited */
  record_type: string | null;
  /** Whether this is the final view in multi-step form */
  is_final_view: boolean;
  /** Disables all buttons when true */
  disabled: boolean;
  /** Callback for stepper navigation */
  onChangeStepper: (viewName: string, activeStepIndex: number) => void;
  /** Current view index in multi-step form */
  view_index: number;
  /** Form state containing submission status */
  formProps: FormProps;
  /** Callback for form submission */
  handleFormSubmit: (closeType: 'close' | 'new') => void;
  /** Array of form views for stepper */
  views: Array<any>;
  /** UI configuration object */
  ui_specification: ProjectUIModel;
  /** Layout type */
  layout?: string;

  visitedSteps: Set<string>;
  isRecordSubmitted: boolean;
}

/**
 * Tooltip content explaining the publish action
 */
const tooltipContent = (
  <div>
    <Box sx={{fontWeight: 'bold', marginBottom: 1}}>
      What does publishing mean?
    </Box>
    Your response is being saved automatically as a draft. When you click
    publish, your response will be uploaded once your device has an internet
    connection.
  </div>
);

/**
 * Button component for form submission with loading state
 */
function FormSubmitButton({
  is_final_view,
  disabled,
  formProps,
  handleFormSubmit,
  is_close,
  text,
  color,
  'data-testid': dataTestId,
}: FormSubmitButtonProps) {
  if (disabled) return null;

  return (
    <Button
      type="button"
      fullWidth
      data-testid={dataTestId}
      color={formProps.isSubmitting ? undefined : color}
      variant={is_final_view && is_close === 'close' ? 'contained' : 'outlined'}
      disableElevation
      disabled={formProps.isSubmitting}
      onClick={() => handleFormSubmit(is_close)}
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
  disabled,
  onChangeStepper,
  view_index,
  formProps,
  handleFormSubmit,
  visitedSteps,
  isRecordSubmitted,
  views,
  ui_specification,
  layout,
}: FormButtonGroupProps) {
  const [tooltipOpen, setTooltipOpen] = useState<boolean>(false);

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
      {views.length > 1 && layout !== 'inline' && (
        <CustomMobileStepper
          views={views}
          view_index={view_index}
          onChangeStepper={onChangeStepper}
          ui_specification={ui_specification}
          visitedSteps={visitedSteps || new Set()}
          isRecordSubmitted={isRecordSubmitted || false}
        />
      )}
      <Grid container spacing={2}>
        <Grid item xs={10.5}>
          <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
            <FormSubmitButton
              color="primary"
              data-testid="publish-close-record"
              disabled={disabled}
              formProps={formProps}
              text={`Publish and close ${record_type}`}
              is_close="close"
              handleFormSubmit={handleFormSubmit}
              is_final_view={is_final_view}
            />
            <FormSubmitButton
              color="secondary"
              disabled={disabled}
              formProps={formProps}
              text={`Publish and new ${record_type}`}
              is_close="new"
              handleFormSubmit={handleFormSubmit}
              is_final_view={is_final_view}
            />
          </Box>
        </Grid>
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
