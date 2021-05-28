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
 * Filename: actions.tsx
 * Description: 
 *   TODO
 */
 
import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {useHistory} from 'react-router-dom';
import {Grid, Button, TextField} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
// import Skeleton from '@material-ui/lab/Skeleton';
import * as ROUTES from '../../../constants/routes';
import {ProjectInformation} from '../../../datamodel';
type DashboardActionProps = {
  pouchProjectList: ProjectInformation[];
};
const useStyles = makeStyles(() => ({
  fullHeightButton: {
    height: '100%',
  },
}));

export default function DashboardActions(props: DashboardActionProps) {
  const {pouchProjectList} = props;
  const classes = useStyles();
  const history = useHistory();
  const options = pouchProjectList.map(project_info => ({
    title: project_info.name,
    url: ROUTES.PROJECT + project_info.project_id,
  }));
  const [value, setValue] = React.useState(
    options.length > 0 ? options[0] : null
  );
  const [inputValue, setInputValue] = React.useState('');
  const handleSubmit = () => {
    if (value !== null) {
      history.push(value.url + ROUTES.OBSERVATION_CREATE);
    }
  };
  return (
    <React.Fragment>
      {options.length > 0 ? (
        <form onSubmit={handleSubmit}>
          <Grid container={true}>
            <Grid>
              <Autocomplete
                id="combo-box-demo"
                value={value}
                onChange={(event, newValue) => {
                  if (newValue !== null) {
                    setValue(newValue);
                  }
                }}
                size={'small'}
                inputValue={inputValue}
                onInputChange={(event, newInputValue) => {
                  setInputValue(newInputValue);
                }}
                options={options}
                getOptionLabel={option => option.title}
                style={{width: 300}}
                openOnFocus={true}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Select Project"
                    variant="outlined"
                  />
                )}
              />
            </Grid>
            <Grid>
              <Button
                classes={{root: classes.fullHeightButton}}
                variant="contained"
                color="primary"
                size={'medium'}
                type={'submit'}
                style={{marginLeft: '5px'}}
              >
                Add
              </Button>
            </Grid>
          </Grid>
        </form>
      ) : (
        'No Projects Found'
      )}
    </React.Fragment>
  );
}
