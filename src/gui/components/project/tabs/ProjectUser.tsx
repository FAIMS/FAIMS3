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
 * Filename: ProjectUser.tsx
 * Description:This is the file about Project User Invite
 * TODO: add select to user list area
 */
import React from 'react';
import {useState} from 'react';

import {Grid, Typography, Box} from '@mui/material';
import {Formik, Form} from 'formik';
import {getComponentFromField} from '../FormElement';
import {ProjectSubmit} from './ProjectButton';
import {
  setProjectInitialValues,
  getprojectform,
  checkvalid,
} from '../data/ComponentSetting';
import {ProjectValueList, FAIMShandlerType} from '../../../../datamodel/ui';
import {TabTab} from './TabTab';
import TabPanel from './TabPanel';
import {UserRoleList, UserLists} from './PSettingCard';
import {AddUserButton, Addusersassign} from './ProjectButton';
/* eslint-disable @typescript-eslint/no-unused-vars */
type ProjectUserProps = {
  project_id: string | null;
  projectvalue: ProjectValueList;
  setProjectValue: FAIMShandlerType;
  setProjecttabvalue: FAIMShandlerType;
  formProps: any;
};
type UsergroupTYpe = any;

export default function ProjectUserTab(props: ProjectUserProps) {
  const {projectvalue, setProjectValue, project_id, ...others} = props;
  const [usergroups, setusergroups] = useState<UsergroupTYpe>(
    projectvalue.accesses
  );
  const [uiSpec, setuiSpec] = useState(getprojectform(projectvalue, 'users'));
  const [uiSpecassign, setuiSpecassign] = useState(
    getprojectform(projectvalue, 'usersassign')
  );
  const [initialValues, setinitialValues] = useState(
    setProjectInitialValues(uiSpec, 'start-view', {_id: ''})
  );
  const [initialValuesassign, setinitialValuesassign] = useState(
    setProjectInitialValues(uiSpecassign, 'start-view', {_id: ''})
  );
  const [tabvalue, settabValue] = useState(0);
  const [users, setusesers] = useState(projectvalue.users);
  const [usersadded, setusersadded] = useState('');

  const handleChange = (event: any) => {
    //save project value into DB
    console.log(event.target.name);
    setusersadded(event.target.value);
    // props.handleSubmit()
  };

  const handleChangetab = (event: any, index: number) => {
    setinitialValues(setProjectInitialValues(uiSpec, 'start-view', {_id: ''}));
    setinitialValuesassign(
      setProjectInitialValues(uiSpecassign, 'start-view', {_id: ''})
    );
    settabValue(index);
  };

  const handlerassignuser = (role: string) => {
    const newproject = projectvalue;
    newproject[role] = users; //selectusers[role]
    setProjectValue({...newproject});
    console.log(projectvalue);
  };

  const handleSubmit = (values: any) => {
    console.log('values');
  };

  const addusers = (values: any) => {
    const users = values.split(/\r?\n/);
    const newproject = projectvalue;
    if (newproject['users'] === undefined) {
      newproject['users'] = users;
      newproject['unassignusers'] = users;
      usergroups.map((user: string) => (newproject[user] = []));
    } else {
      newproject['users'] = [...newproject['users'], ...users];
      newproject['unassignusers'] = [...newproject['unassignusers'], ...users];
    }
    newproject['users'] = checkvalid(newproject['users']);
    newproject['unassignusers'] = checkvalid(newproject['unassignusers']);
    setProjectValue({...projectvalue, users: newproject['users']}); //TODO: add to check if duplicated user
    setusesers(newproject['users']);
  };

  const deleteusers = (user: string) => {
    const newproject = projectvalue;
    newproject['users'] = newproject['users'].filter((u: string) => u !== user);
    setProjectValue({...projectvalue, users: newproject['users']});
  };

  const deleteusersassign = (user: string) => {};

  const selectusersgroup = (
    newuser: string,
    usergroup: string,
    select: boolean
  ) => {
    const newproject = projectvalue;
    let newusers = newproject[usergroup] ?? [];
    if (select) {
      newusers = [...newusers, newuser];
      newproject['unassignusers'] = newproject['unassignusers'].filter(
        (u: string) => u !== newuser
      );
    } else {
      newusers = newusers.filter((user: string) => user !== newuser);
      newproject['unassignusers'] = [...newproject['unassignusers'], newuser];
    }
    newusers = checkvalid(newusers);
    newproject['unassignusers'] = checkvalid(newproject['unassignusers']);
    newproject[usergroup] = newusers;
    setProjectValue({...newproject});
  };

  const getfield = (
    usergroup: string,
    formProps: any,
    handleChange: any,
    uiSpec: any
  ) => {
    return (
      <Grid container>
        <Grid item sm={4} xs={12}>
          <br />
          <Typography variant="subtitle2">All users</Typography>
          <UserLists
            users={projectvalue.unassignusers ?? []}
            delete={false}
            handelonClick={selectusersgroup}
            usergroup={usergroup}
            select={true}
          />
        </Grid>
        <Grid item sm={1} xs={12}>
          <br />
          <Addusersassign onButtonClick={handlerassignuser} value={usergroup} />
        </Grid>
        <Grid item sm={7} xs={12}>
          <br />
          <Typography variant="subtitle2">Role: {usergroup} </Typography>
          <UserLists
            users={projectvalue[usergroup] ?? []}
            handelonClick={selectusersgroup}
            usergroup={usergroup}
            select={false}
          />
        </Grid>
      </Grid>
    );
  };

  const addtab = (uiSpec: any, handleSubmit: any, handleChange: any) => {
    return (
      <Grid container>
        <Grid item sm={6} xs={12}>
          {uiSpec['views']['start-view'] !== undefined
            ? uiSpec['views']['start-view']['fields'].map((fieldName: string) =>
                getComponentFromField(
                  uiSpec,
                  fieldName,
                  props.formProps,
                  handleChange
                )
              )
            : ''}
          <Box pl={2} pr={2}>
            <AddUserButton
              id="submit"
              type="submit"
              onButtonClick={addusers}
              value={usersadded}
            />
          </Box>
          <Box pl={2} pr={2}>
            {projectvalue.users !== undefined ? (
              <ProjectSubmit
                id="gotonext_info"
                type="submit"
                isSubmitting={false}
                text="Go To Next"
                onButtonClick={() => settabValue(1)}
              />
            ) : (
              ''
            )}
          </Box>
        </Grid>
        <Grid item sm={6} xs={12}>
          <UserRoleList
            users={projectvalue.users ?? []}
            deleteuserrole={deleteusers}
          />
        </Grid>
      </Grid>
    );
  };

  return (
    <>
      <TabTab
        tabs={['add', 'User Role']}
        value={tabvalue}
        handleChange={handleChangetab}
        tab_id="projectuser"
      />
      <TabPanel value={tabvalue} index={0} tabname="projectuser">
        {addtab(uiSpec, addusers, handleChange)}
      </TabPanel>
      <TabPanel value={tabvalue} index={1} tabname="projectuser">
        {tabvalue === 1 && projectvalue.users !== undefined ? (
          <Formik
            initialValues={initialValuesassign}
            validateOnMount={true}
            onSubmit={(values, {setSubmitting}) => {
              setTimeout(() => {
                setSubmitting(false);
                handleSubmit(values);
              }, 500);
            }}
          >
            {formProps => {
              return (
                <Form>
                  {usergroups.map((usergroup: string) =>
                    getfield(usergroup, formProps, handleChange, uiSpecassign)
                  )}
                </Form>
              );
            }}
          </Formik>
        ) : (
          'Please add users to activate this feature'
        )}
        <ProjectSubmit
          id="gotonext_info"
          type="submit"
          isSubmitting={false}
          text="Go To Next"
          onButtonClick={() => props.setProjecttabvalue(5)}
        />
      </TabPanel>
    </>
  );
}
