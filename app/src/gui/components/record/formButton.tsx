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

import {
  Alert,
  AlertTitle,
  Button,
  ButtonGroup,
  Divider,
  Grid,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

import {CustomMobileStepper} from './recordStepper';

function FormSubmitButton(props: any) {
  const {is_final_view, disabled, formProps, handleFormSubmit, is_close, text} =
    props;
  return disabled !== true ? (
    <Button
      type="button"
      data-testid={props['data-testid']}
      color={formProps.isSubmitting ? undefined : 'primary'}
      variant={is_final_view && is_close === 'close' ? 'contained' : 'outlined'}
      disableElevation
      disabled={formProps.isSubmitting}
      onClick={() => handleFormSubmit(is_close)}
    >
      {formProps.isSubmitting ? 'Working...' : text}
      {formProps.isSubmitting && (
        <CircularProgress
          size={24}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -12,
            marginLeft: -12,
          }}
        />
      )}
    </Button>
  ) : (
    <></>
  );
}

export default function FormButtonGroup(props: any) {
  const {
    is_final_view,
    disabled,
    onChangeStepper,
    view_index,
    formProps,
    handleFormSubmit,
    views,
    ui_specification,
    mq_above_md,
  } = props;
  return (
    <Grid item sm={12} xs={12} md={12}>
      {/* show mobile stepper for multiple section form ONLY */}
      {views.length > 1 && (
        <Grid item>
          <CustomMobileStepper
            views={views}
            view_index={view_index}
            onChangeStepper={onChangeStepper}
            ui_specification={ui_specification}
          />
        </Grid>
      )}
      <Grid container spacing={2}>
        <Grid item md={12}>
          <br />
          <ButtonGroup
            color="primary"
            aria-label="contained primary button group"
            orientation={mq_above_md ? 'horizontal' : 'vertical'}
          >
            {/* need to fix the issue and re-enable it */}
            <FormSubmitButton
              disabled={disabled}
              formProps={formProps}
              text="Publish and continue editing"
              is_close={'continue'}
              handleFormSubmit={handleFormSubmit}
              is_final_view={is_final_view}
            />
            <FormSubmitButton
              data-testid="publish-close-record"
              disabled={disabled}
              formProps={formProps}
              text="Publish and Close Record"
              is_close={'close'}
              handleFormSubmit={handleFormSubmit}
              is_final_view={is_final_view}
            />
            <FormSubmitButton
              disabled={disabled}
              formProps={formProps}
              text="Publish and New Record"
              is_close={'new'}
              handleFormSubmit={handleFormSubmit}
              is_final_view={is_final_view}
            />
            <Divider />
          </ButtonGroup>
        </Grid>
        <Grid item sm={12} xs={12} md={12}>
          {disabled !== true && (
            <Alert severity={'info'} variant="outlined">
              <AlertTitle>What does publishing mean?</AlertTitle>
              The data you capture are being saved to your device constantly in
              a draft state. When you click publish, the record will be queued
              for syncing to the remote server when the app detects a wifi
              connection.
            </Alert>
          )}
        </Grid>
      </Grid>
    </Grid>
  );
}
