/*
 * Copyright 2021 Macquarie University
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
 * Filename: RelatedRecordSelector.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Link as RouterLink} from 'react-router-dom';
import Button from '@material-ui/core/Button';
import AddIcon from '@material-ui/icons/Add';

import {fieldToTextField, TextFieldProps} from 'formik-material-ui';

import * as ROUTES from '../../constants/routes';

interface Props {
  related_type: string;
  relation_type: string;
}

export class RelatedRecordSelector extends React.Component<
  TextFieldProps & Props
> {
  render() {
    const {related_type, relation_type, ...textFieldProps} = this.props;
    const project_id = this.props.form.values['_project_id'];
    return (
      <Button
        variant="outlined"
        color="primary"
        startIcon={<AddIcon />}
        // If the list of views hasn't loaded yet
        // we can still show this button, except it will
        // redirect to the Record creation without known type
        component={RouterLink}
        to={
          ROUTES.PROJECT +
          project_id +
          ROUTES.RECORD_CREATE +
          ROUTES.RECORD_TYPE +
          related_type
        }
      >
        New Record
      </Button>
    );
  }
}
