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
import {ProjectUIModel} from 'faims3-datamodel';
// import makeStyles from '@mui/styles/makeStyles';
import {createUseStyles} from 'react-jss';
type RecordStepperProps = {
  view_index: number;
  ui_specification: ProjectUIModel;
  onChangeStepper: any;
  views: {[key: string]: any};
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
  },
});

export default function RecordStepper(props: RecordStepperProps) {
  const classes = useStyles();
  const {
    view_index,
    ui_specification,
    onChangeStepper,
    views, //add for branching logic
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
            {views.map((view_name: string, index: number) => (
              <Step key={view_name}>
                <StepButton
                  onClick={() => {
                    onChangeStepper(view_name, index);
                  }}
                  sx={{width: '93%'}}
                >
                  {ui_specification.views[view_name].label}
                </StepButton>
              </Step>
            ))}
          </Stepper>
        </div>
      </Box>
      <Box display={{xs: 'block', sm: 'none'}}>
        <CustomMobileStepper
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
      steps={views.length}
      position="static"
      activeStep={view_index}
      nextButton={
        <Button
          size="small"
          onClick={() => {
            const stepnum = view_index + 1;
            onChangeStepper(views[stepnum], stepnum);
          }}
          disabled={view_index === views.length - 1}
        >
          Next
        </Button>
      }
      backButton={
        <Button
          size="small"
          onClick={() => {
            const stepnum = view_index - 1;
            onChangeStepper(views[stepnum], stepnum);
          }}
          disabled={view_index === 0}
        >
          Back
        </Button>
      }
    />
  );
}
