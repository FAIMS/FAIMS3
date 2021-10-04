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
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import {FieldProps} from 'formik';

import * as ROUTES from '../../constants/routes';
import {FAIMSTypeName} from '../../datamodel/core';
import {RecordReference} from '../../datamodel/ui';
import {getAllRecordsOfType} from '../../data_storage/queries';

interface Props {
  related_type: FAIMSTypeName;
  relation_type: FAIMSTypeName;
}

export function RelatedRecordSelector(props: FieldProps & Props) {
  const project_id = props.form.values['_project_id'];
  const [options, setOptions] = React.useState<RecordReference[]>([]);

  React.useEffect(() => {
    (async () => {
      const records = await getAllRecordsOfType(project_id, props.related_type);
      setOptions(records);
    })();
  }, []);

  // Note the "multiple" option below, that seems to control whether multiple
  // entries can in entered.
  // TODO: Have the relation_type set the multiplicity of the system
  return (
    <div>
      <Autocomplete
        multiple
        id="asynchronous-demo"
        style={{width: 300}}
        getOptionSelected={(option, value) =>
          option.project_id === value.project_id &&
          option.record_id === value.record_id
        }
        getOptionLabel={option => option.record_label}
        options={options}
        renderInput={params => (
          <TextField
            {...params}
            label="Asynchronous"
            variant="outlined"
            InputProps={{
              ...params.InputProps,
            }}
          />
        )}
      />
      <Button
        variant="outlined"
        color="primary"
        startIcon={<AddIcon />}
        component={RouterLink}
        to={
          ROUTES.PROJECT +
          project_id +
          ROUTES.RECORD_CREATE +
          ROUTES.RECORD_TYPE +
          props.related_type
        }
      >
        New Record
      </Button>
    </div>
  );
}
