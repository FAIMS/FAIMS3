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
  Badge,
} from '@mui/material';
import {ProjectUIModel} from '@faims3/data-model';
// import makeStyles from '@mui/styles/makeStyles';
import {createUseStyles} from 'react-jss';
type RecordStepperProps = {
  view_index: number;
  ui_specification: ProjectUIModel;
  onChangeStepper: (view: string, index: number) => void;
  views: {[key: string]: any};

  //New RG
  steps: string[];
  activeStep: number;
  formErrors: {[key: string]: string | undefined};
  touchedFields: TouchedFields;
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
      backgroundColor: '#ccc',
      borderRadius: 5,
    },
  },
  errorHighlight: {
    border: '2px solid red',
    backgroundColor: '#54E3D2FF',
    transition: 'background-color 0.5s ease',
  },
});

// ✅ Get Error Count for Badges
const getErrorCount = (stepFields: string[] = [], formErrors: FormErrors) => {
  return stepFields.filter(field => formErrors[field]).length;
};

type FormErrors = {[key: string]: string | undefined};
type TouchedFields = string[];

// ✅ Dynamic Step Colors
const getStepColor = (
  index: number,
  formErrors: FormErrors,
  touchedFields: TouchedFields
): string => {
  if (Object.keys(formErrors).some(err => touchedFields.includes(err))) {
    return 'orange'; // Errors exist
  }
  if (touchedFields.length > 0) {
    return 'green'; // Completed
  }
  return 'red'; // Not Started
};

// ✅ Smooth Scroll to Error
const scrollToError = (fieldId: string) => {
  const element = document.getElementById(fieldId);
  if (element) {
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    element.classList.add('error-highlight');
    setTimeout(() => element.classList.remove('error-highlight'), 3000);
  }
};

export default function RecordStepper(props: RecordStepperProps) {
  const classes = useStyles();
  const {
    view_index,
    ui_specification,
    onChangeStepper,
    views, //add for branching logic
    formErrors,
    touchedFields,
  } = props;
  // active step has been replaced by view_index because view_index will be updated every time form values updated
  // 20220727 bbs the width 93% gets rid of the overflowX in the PSMIP notebook at most standard resolutions
  // Client didn't want the absence of the stepper in sm-md resolutions, so reverted md->sm and am making text changes
  return (
    <>
      <Box display={{xs: 'none', sm: 'block'}} py={1}>
        <div style={{overflowX: 'hidden'}}>
          <Stepper
            nonLinear
            activeStep={view_index}
            alternativeLabel
            className={classes.stepperStyle}
          >
            {Object.keys(views).map((view_name: string, index: number) => {
              if (!ui_specification.views[view_name]) {
                console.warn(`Missing view config for: ${view_name}`);
                return null;
              }
              const errorCount = getErrorCount(
                views[view_name].fields,
                formErrors
              );
              const stepColor = getStepColor(index, formErrors, touchedFields);

              return (
                <Step key={view_name}>
                  <Badge
                    badgeContent={errorCount > 0 ? errorCount : null}
                    color="error"
                    overlap="circular"
                    anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                    onClick={() =>
                      scrollToError(views[view_name]?.fields?.[0] ?? '')
                    }
                  >
                    <StepButton
                      onClick={() => onChangeStepper(view_name, index)}
                      sx={{color: stepColor, width: '93%'}}
                    >
                      {ui_specification.views[view_name]?.label ||
                        'Unnamed Step'}
                    </StepButton>
                  </Badge>
                </Step>
              );
            })}
          </Stepper>
        </div>
      </Box>

      {/* ✅ Mobile View Stepper */}
      <Box display={{xs: 'block', sm: 'none'}}>
        <CustomMobileStepper
          {...props}
          views={views}
          view_index={view_index}
          onChangeStepper={onChangeStepper}
          ui_specification={ui_specification}
        />
        <Typography variant="h5" align="center">
          {ui_specification.views[views[view_index]]?.label}
        </Typography>
      </Box>
    </>
  );
}

export function CustomMobileStepper(props: RecordStepperProps) {
  const {views, view_index, onChangeStepper} = props;
  return (
    <MobileStepper
      variant="text"
      steps={Array.isArray(views) ? views.length : 0}
      position="static"
      activeStep={view_index}
      nextButton={
        <Button
          size="small"
          onClick={() => onChangeStepper(views[view_index + 1], view_index + 1)}
          disabled={view_index === views.length - 1}
        >
          Next
        </Button>
      }
      backButton={
        <Button
          size="small"
          onClick={() => onChangeStepper(views[view_index - 1], view_index - 1)}
          disabled={view_index === 0}
        >
          Back
        </Button>
      }
    />
  );
}
