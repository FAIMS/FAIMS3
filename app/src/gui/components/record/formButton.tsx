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

import {Alert, AlertTitle, Button} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import {CustomMobileStepper} from './recordStepper';

function FormSubmitButton(props: any) {
  const {
    is_final_view,
    disabled,
    formProps,
    handleFormSubmit,
    is_close,
    text,
    color,
  } = props;
  return disabled !== true ? (
    <Button
      type="button"
      style={{
        width: '100%',
      }}
      data-testid={props['data-testid']}
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
    record_type,
    is_final_view,
    disabled,
    onChangeStepper,
    view_index,
    formProps,
    handleFormSubmit,
    views,
    ui_specification,
    layout,
  } = props;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {views.length > 1 && layout !== 'inline' && (
        <CustomMobileStepper
          views={views}
          view_index={view_index}
          onChangeStepper={onChangeStepper}
          ui_specification={ui_specification}
        />
      )}
      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
        <FormSubmitButton
          color="primary"
          data-testid="publish-close-record"
          disabled={disabled}
          formProps={formProps}
          text={`Publish and close ${record_type}`}
          is_close={'close'}
          handleFormSubmit={handleFormSubmit}
          is_final_view={is_final_view}
        />
        <FormSubmitButton
          color="secondary"
          disabled={disabled}
          formProps={formProps}
          text={`Publish and new ${record_type}`}
          is_close={'new'}
          handleFormSubmit={handleFormSubmit}
          is_final_view={is_final_view}
        />
      </div>
      {disabled !== true && (
        <Alert severity={'info'} variant="outlined">
          <AlertTitle>What does publishing mean?</AlertTitle>
          Your response is being saved automatically as a draft. When you click
          publish, your response will be uploaded once your device has an
          internet connection.
        </Alert>
      )}
    </div>
  );
}
