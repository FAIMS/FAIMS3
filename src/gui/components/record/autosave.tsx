/*
 * Copyright 2021,2022 Macquarie University
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
 * Filename: autosave.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Box, CircularProgress} from '@material-ui/core';
import MuiAlert from '@material-ui/lab/Alert';
import moment from 'moment';
import CheckIcon from '@material-ui/icons/Check';

type AutosaveProps = {
  last_saved: Date;
  is_saving: boolean;
  error: string | null;
};
export default function AutoSave(props: AutosaveProps) {
  return (
    <Box mb={2}>
      <MuiAlert
        severity={props.error !== null ? 'error' : 'info'}
        icon={
          props.is_saving ? (
            <CircularProgress
              size={'1.1rem'}
              thickness={5}
              style={{color: '#2196f3'}}
            />
          ) : (
            <CheckIcon fontSize="inherit" />
          )
        }
      >
        <b>{props.error !== null ? props.error : ''}</b>&nbsp; Draft last
        saved&nbsp;
        {moment(props.last_saved).fromNow()}{' '}
        <small>{props.last_saved.toString()}</small>
      </MuiAlert>
    </Box>
  );
}
