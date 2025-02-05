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
import {
  Button,
  Box,
  Typography,
  Step,
  Stepper,
  StepButton,
  MobileStepper,
} from '@mui/material';
import {ProjectUIModel} from '@faims3/data-model';
import {createUseStyles} from 'react-jss';
import {useEffect, useState} from 'react';
import {getStepperColors} from '../../../utils/stepperUtils';

type RecordStepperProps = {
  view_index: number;
  ui_specification: ProjectUIModel;
  onChangeStepper: any;
  views: string[];
  formErrors?: {[fieldName: string]: unknown};
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
      borderColor: '#867D7AFF',
      borderTopWidth: 2,
    },
  },
});

/**
 * Determines the color of each step based on current state
 */
const getStepColor = (
  index: number,
  totalSteps: number,
  errors: any,
  currentStep: number,
  stepperColors: string[],
  visitedSteps: number[],
  validSteps: number[]
) => {
  if (errors && errors[index]) return '#B10000';

  // Keep color if visited, otherwise gray
  if (visitedSteps.includes(index) && validSteps.includes(index)) {
    return stepperColors[index];
  }
  // Current Step
  if (index === currentStep) return stepperColors[index];

  // Completed Steps
  // if (index < currentStep) return stepperColors[index];

  // Unvisited Steps
  return '#BDBDBD';
};

/**
 * RecordStepper Component
 * Displays the stepper for large screens with dynamic colors and transitions.
 */
export default function RecordStepper(props: RecordStepperProps) {
  const classes = useStyles();
  const {view_index, ui_specification, onChangeStepper, views, formErrors} =
    props;
  const stepperColors = getStepperColors(views.length);
  const [visitedSteps, setVisitedSteps] = useState<number[]>([]);
  const [validSteps, setValidSteps] = useState<number[]>([]);

  //  update visited steps
  useEffect(() => {
    if (!visitedSteps.includes(view_index)) {
      setVisitedSteps(prev => [...prev, view_index]);
    }

    const currentViewFields = ui_specification.views[views[view_index]].fields;
    const hasErrors = currentViewFields.some(
      field => formErrors && formErrors[field]
    );

    // update valid steps
    if (!hasErrors && !validSteps.includes(view_index)) {
      setValidSteps(prev => [...prev, view_index]);
    }
  }, [view_index, formErrors]);

  return (
    <>
      <Box display={{xs: 'none', sm: 'block'}} py={1}>
        <div style={{overflowX: 'visible', position: 'relative', zIndex: 1}}>
          {' '}
          <Stepper
            nonLinear
            activeStep={view_index}
            alternativeLabel
            className={classes.stepperStyle}
            sx={{padding: '15px 0'}}
          >
            {views.map((view_name: string, index: number) => {
              return (
                <Step key={view_name}>
                  <StepButton
                    onClick={() => {
                      onChangeStepper(view_name, index);
                    }}
                    sx={{
                      width: '94%',
                      '& .MuiStepLabel-label': {
                        color: getStepColor(
                          index,
                          views.length,
                          formErrors,
                          view_index,
                          stepperColors,
                          visitedSteps,
                          validSteps
                        ),
                        fontWeight: index === view_index ? 'bold' : 'normal',
                        transition: 'color 0.3s ease-in-out',
                        fontSize: '1rem',
                      },

                      '& .MuiStepIcon-root': {
                        color: getStepColor(
                          index,
                          views.length,
                          formErrors,
                          view_index,
                          stepperColors,
                          visitedSteps,
                          validSteps
                        ),
                        borderRadius: '50%',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        width: '26px',
                        height: '26px',
                        boxShadow:
                          index === view_index
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
                    {ui_specification.views[view_name].label}
                  </StepButton>
                </Step>
              );
            })}
          </Stepper>
        </div>
      </Box>
      {/* <Box display={{xs: 'block', sm: 'none'}}>
        <CustomMobileStepper
          views={views}
          view_index={view_index}
          onChangeStepper={onChangeStepper}
          ui_specification={ui_specification}
          formErrors={formErrors}
        />
        <Typography variant="h5" align="center">
          {ui_specification.views[views[view_index]]?.label}
        </Typography>
      </Box> */}
    </>
  );
}

/**
 * CustomMobileStepper Component
 * Handles the mobile version of the stepper with basic navigation controls.
 */
export function CustomMobileStepper(props: RecordStepperProps) {
  const {views, view_index, onChangeStepper, formErrors} = props;
  const totalSteps = views.length;

  // Check if current step has errors
  const hasError = Object.keys(formErrors || {}).some(field =>
    views[view_index].includes(field)
  );

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 10,
        p: 1,
        borderBottom: '1px solid #ccc',
      }}
    >
      {/* Step count with error indicator */}
      <Typography variant="h6" align="center" sx={{fontWeight: 'bold', mb: 1}}>
        Step {view_index + 1} of {totalSteps} {hasError && ' 🔴'}
      </Typography>
      <MobileStepper
        variant="text"
        steps={views.length}
        position="static"
        activeStep={view_index}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        nextButton={
          <Button
            size="small"
            sx={{px: 2, py: 1, fontWeight: 'bold'}}
            onClick={() =>
              onChangeStepper(views[view_index + 1], view_index + 1)
            }
            disabled={view_index === views.length - 1}
          >
            Next
          </Button>
        }
        backButton={
          <Button
            size="small"
            sx={{px: 2, py: 1, fontWeight: 'bold'}}
            onClick={() =>
              onChangeStepper(views[view_index - 1], view_index - 1)
            }
            disabled={view_index === 0}
          >
            Back
          </Button>
        }
      />
    </Box>
  );
}
