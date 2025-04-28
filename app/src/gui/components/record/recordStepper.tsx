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
 * Filename: RecordTabBar.tsx
 * Description:
 *   ONLY for Draft use
 *   Steppers show sections of Form
 *   MobileStepper for small screen ONLY
 */
import {ProjectUIModel} from '@faims3/data-model';
import {
  Badge,
  Box,
  Button,
  MobileStepper,
  Step,
  StepButton,
  Stepper,
  Typography,
  useTheme,
} from '@mui/material';
import {createUseStyles} from 'react-jss';
import {getStepColor} from '../../../utils/generateStepperColors';

type RecordStepperProps = {
  view_index: number;
  ui_specification: ProjectUIModel;
  onChangeStepper: (view_id: string, index: number) => void;
  views: string[];
  formErrors?: {[fieldName: string]: unknown};
  visitedSteps: Set<string>;
  isRecordSubmitted: boolean;
};

const useStyles = createUseStyles({
  stepperStyle: {
    overflowY: 'hidden',
    overflowX: 'auto',
    '&::-webkit-scrollbar': {
      width: 10,
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: '#fff',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: '#fff',
      borderRadius: 2,
    },
    '& .MuiStepConnector-line': {
      borderColor: '#383534FF',
      borderTopWidth: 2,
    },
  },
});

/**
 * @function RecordStepper
 * @description
 *   Displays a stepper component for multi-step forms, allowing navigation
 *   between different views or sections. Handles visual indicators for visited steps,
 *   validation status, and current active step. Adjusts layout responsively
 *   for desktop and mobile views.
 *
 * @param {RecordStepperProps} props
 *   - `view_index`: The index of the currently active view/step.
 *   - `ui_specification`: The UI model containing view metadata and labels.
 *   - `onChangeStepper`: Callback function to handle step changes.
 *   - `views`: An array of view names representing form sections.
 *   - `formErrors`: (Optional) Object representing validation errors for fields.
 *
 * @returns {JSX.Element}
 *   A stepper UI for navigating through form sections with error indicators
 *   and dynamic styling.
 *
 * @features
 *   - Dynamic step color updates based on validation status.
 *   - Tracks visited and valid steps.
 *   - Responsive layout: horizontal stepper for large screens,
 *     and mobile stepper for smaller screens.
 */

/**
 * Checks if a section has any validation errors
 */
const hasErrorsGlobal = (
  sectionId: string | undefined,
  visitedSteps: Set<string>,
  ui_specification: ProjectUIModel,
  formErrors?: {[fieldName: string]: unknown}
) => {
  if (!sectionId || !visitedSteps || !ui_specification.views[sectionId])
    return false;

  return (
    visitedSteps.has(sectionId) &&
    ui_specification.views[sectionId]?.fields.some(
      field => formErrors && formErrors[field]
    )
  );
};

export default function RecordStepper(props: RecordStepperProps) {
  const classes = useStyles();
  const {
    visitedSteps,
    view_index,
    ui_specification,
    onChangeStepper,
    views,
    formErrors,
    isRecordSubmitted,
  } = props;

  const theme = useTheme();

  // function to check if stepper has erros
  const hasErrors = (sectionId: string | undefined) => {
    if (!sectionId || !visitedSteps || !ui_specification.views[sectionId])
      return false;

    return (
      visitedSteps.has(sectionId) &&
      ui_specification.views[sectionId]?.fields.some(
        field => formErrors && formErrors[field]
      )
    );
  };

  return (
    <>
      <Box display={{xs: 'none', sm: 'block'}} py={1}>
        <div style={{overflowX: 'visible', position: 'relative', zIndex: 1}}>
          <Stepper
            nonLinear
            activeStep={view_index}
            alternativeLabel
            className={classes.stepperStyle}
            sx={{padding: '15px 0'}}
          >
            {views.map((sectionId: string, index: number) => {
              return (
                <Step key={sectionId}>
                  <StepButton
                    onClick={() => {
                      props.onChangeStepper(sectionId, index);
                    }}
                    sx={{
                      width: '94%',
                      '& .MuiStepLabel-label': {
                        color: theme.palette.primary.dark,
                        fontWeight: 'bold',
                        transition: 'color 0.3s ease-in-out',
                        fontSize: '1rem',
                      },
                      '& .MuiStepIcon-root': {
                        color: getStepColor(
                          sectionId,
                          views[view_index],
                          hasErrorsGlobal(
                            sectionId,
                            visitedSteps,
                            ui_specification,
                            formErrors
                          ),
                          visitedSteps,
                          isRecordSubmitted
                        ),
                        borderRadius: '50%',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        width: '26px',
                        height: '26px',
                        boxShadow:
                          sectionId === views[view_index]
                            ? '0px 4px 12px rgba(0, 0, 0, 0.3)'
                            : '0px 2px 4px rgba(0, 0, 0, 0.15)',
                        transition: 'all 0.3s ease-in-out',
                        zIndex: 10,
                      },
                      '&:hover': {
                        transform: 'scale(1.1)',
                        boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.2)',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        transition: 'all 0.3s ease-in-out',
                        zIndex: 10,
                        borderRadius: '10%',
                        minWidth: '80px',
                        minHeight: '40px',
                      },
                    }}
                  >
                    {ui_specification.views[sectionId]?.label}
                  </StepButton>
                </Step>
              );
            })}
          </Stepper>
        </div>
      </Box>

      {/* Top step number (Desktop + Mobile common) */}
      <Box mt={2} mb={2}>
        <Typography
          variant="h5"
          align="center"
          sx={{
            fontWeight: 700,
            fontSize: {xs: '1.4rem', sm: '1.6rem'},
          }}
        >
          {`${view_index + 1} / ${views.length}`}
        </Typography>
      </Box>

      {/* Form section title */}
      <Box mb={2}>
        <Typography
          variant="h4"
          align="center"
          sx={{
            fontWeight: 600,
            fontSize: {xs: '1.2rem', sm: '1.5rem'},
          }}
        >
          {ui_specification.views[views[view_index]]?.label}
        </Typography>
      </Box>
    </>
  );
}

/**
 * Renders a reusable stepper button for navigation.
 * @param {string} label - Button text (e.g., "Next", "Back")
 * @param {number} stepIndex - Index of the step to navigate to
 * @param {boolean} isDisabled - If the button should be disabled
 * @param {Function} onChangeStepper - Callback to handle step change
 * @param {string[]} views - Array of all views
 * @param {Function} hasErrors - Function to check if step has errors
 */
const renderStepperButton = (
  label: 'Next' | 'Back',
  stepIndex: number,
  isDisabled: boolean,
  onChangeStepper: (view_id: string, index: number) => void,
  views: string[],
  visitedSteps: Set<string>,
  ui_specification: ProjectUIModel,
  formErrors?: {[fieldName: string]: unknown}
) => {
  const hasError = hasErrorsGlobal(
    views[stepIndex],
    visitedSteps,
    ui_specification,
    formErrors
  );

  return (
    <Button
      size="small"
      onClick={() => onChangeStepper(views[stepIndex], stepIndex)}
      disabled={isDisabled}
      sx={{
        fontWeight: 'bold',
        fontSize: '1rem',
        textTransform: 'none',
        border: '1px solid',
        borderColor: isDisabled ? 'grey.300' : 'grey.500',
        backgroundColor: isDisabled ? 'grey.100' : 'grey.200',
        color: isDisabled
          ? 'grey.500'
          : hasError
            ? 'error.main'
            : 'text.primary',
        padding: '6px 16px',
        borderRadius: '8px',
        '&:hover': {
          backgroundColor: isDisabled ? 'grey.100' : 'grey.300',
        },
      }}
    >
      <Badge
        badgeContent={hasError ? '!' : 0}
        color="error"
        invisible={!hasError}
      >
        {label}
      </Badge>
    </Button>
  );
};

/**
 * @function CustomMobileStepper
 * @description
 *   Renders a mobile-friendly stepper component with "Next" and "Back" navigation controls,
 *   allowing users to switch between form sections easily. Displays the current step count
 *   and an error indicator if validation errors exist on the current step. Designed to be
 *   responsive and sticky at the top of the viewport for better accessibility on mobile devices.
 *
 * @param {RecordStepperProps} props
 *   - `views`: An array of view names representing different form sections.
 *   - `view_index`: The index of the currently active view/step.
 *   - `onChangeStepper`: Callback function to handle step transitions (forward or backward).
 *   - `formErrors`: (Optional) Object representing validation errors for specific fields.
 *
 * @returns {JSX.Element}
 *   A mobile-optimized stepper with navigation buttons, step indicators, and error notifications.
 *
 * @features
 *   - "Next" and "Back" buttons for easy navigation between steps.
 *   - Displays the current step number and highlights errors with an indicator.
 *   - Sticky positioning for persistent visibility during scrolling.
 *   - Responsive design optimized for small screens using Material-UI's `MobileStepper`.
 */

/**
 * Custom mobile stepper for navigation on smaller screens.
 */
export function CustomMobileStepper(
  props: RecordStepperProps & {isBottom?: boolean}
) {
  const {
    views,
    view_index,
    onChangeStepper,
    visitedSteps,
    formErrors,
    ui_specification,
    isBottom,
  } = props;

  const totalSteps = views.length;

  if (!isBottom) {
    return null;
  }

  return (
    <Box
      sx={{
        width: '100%',
        background: 'transparent',
        py: 2,
        mt: 4,
      }}
    >
      <MobileStepper
        variant="text"
        steps={totalSteps}
        position="static"
        activeStep={view_index}
        nextButton={renderStepperButton(
          'Next',
          view_index + 1,
          view_index === totalSteps - 1,
          onChangeStepper,
          views,
          visitedSteps,
          ui_specification,
          formErrors
        )}
        backButton={renderStepperButton(
          'Back',
          view_index - 1,
          view_index === 0,
          onChangeStepper,
          views,
          visitedSteps,
          ui_specification,
          formErrors
        )}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      />
    </Box>
  );
}
