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
 * Filename: actions.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Grid, Button, TextField} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
// import Skeleton from '@material-ui/lab/Skeleton';
import * as ROUTES from '../../../constants/routes';
import {ProjectInformation} from '../../../datamodel/ui';
import {ProjectUIViewsets} from '../../../datamodel/typesystem';
import {getUiSpecForProject} from '../../../uiSpecification';
import {useEventedPromise} from '../../pouchHook';
import {listenProjectList} from '../../../databaseAccess';
import {listenProjectDB} from '../../../sync';
import {Link as RouterLink} from 'react-router-dom';
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
  const options = pouchProjectList.map(project_info => ({
    title: project_info.name,
    url: ROUTES.PROJECT + project_info.project_id,
    value: project_info.project_id,
  }));
  const [value, setValue] = React.useState<any | null>(null);
  const [inputValue, setInputValue] = React.useState('');
  const handleSubmit = () => {
    // if (value !== null) {
    //   history.push(value.url + ROUTES.RECORD_CREATE);
    // }
  };

  const viewSets = useEventedPromise(
    async () => {
      const viewSets = {} as {
        [ProjectID: string]: [ProjectUIViewsets, string[]];
      };
      const promises = [] as Promise<unknown>[];
      for (const project_info of pouchProjectList) {
        promises.push(
          getUiSpecForProject(project_info.project_id).then(uiSpec => {
            viewSets[project_info.project_id] = [
              uiSpec.viewsets,
              uiSpec.visible_types,
            ];
          })
        );
      }
      return Promise.all(promises).then(() => viewSets);
    },
    // Both a change in the whole list of projects as well
    // as a change in the individual project metadata DBs (for uiSpec)
    // can trigger updat
    (trig, err) => {
      const project_list_detach = listenProjectList(trig, err);
      const individual_project_detachs = pouchProjectList.map(project_info => {
        const project_id = project_info.project_id;
        return listenProjectDB(
          project_id,
          {since: 'now', live: true},
          trig,
          err
        );
      });
      return () => {
        project_list_detach();
        individual_project_detachs.forEach(detach => detach());
      };
    },
    true,
    [] //pouchProjectList is dependency, but events come from listenProjectList
  ).expect();

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
                    console.log(newValue);
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
            {value !== null && viewSets !== null && value.value in viewSets ? (
              <Grid>
                {viewSets[value.value][1].map(
                  viewset_name =>
                    viewSets[value.value][0][viewset_name].is_visible !==
                      false && (
                      <Button
                        classes={{root: classes.fullHeightButton}}
                        variant="contained"
                        color="primary"
                        size={'medium'}
                        type={'submit'}
                        style={{marginLeft: '5px'}}
                        key={viewset_name + 'viewset'}
                        component={RouterLink}
                        to={
                          ROUTES.PROJECT +
                          value.value +
                          ROUTES.RECORD_CREATE +
                          viewset_name
                        }
                      >
                        {viewSets[value.value][1].length === 1
                          ? 'Add'
                          : 'Add ' +
                            (viewSets[value.value][0][viewset_name].label ||
                              viewset_name)}
                      </Button>
                    )
                )}
              </Grid>
            ) : (
              <></>
            )}
          </Grid>
        </form>
      ) : (
        'No Projects Found'
      )}
    </React.Fragment>
  );
}
