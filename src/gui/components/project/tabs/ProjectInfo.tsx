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
 * Filename: ProjectInfo.tsx
 * Description:This is the file about Project Info
 *
 */
import {useState} from 'react';

import {makeStyles} from '@material-ui/core/styles';

import {FormForm} from '../FormElement';
import {
  getprojectform,
  handlertype,
  projectvalueType,
} from '../data/ComponentSetting';
import {getProjectInfo} from '../../../../databaseAccess';

/* TODO: fix eslint @KateSHENG */
/* eslint-disable */

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
  },
  newfield: {
    // backgroundColor:'#e1e4e8',
    // borderTop:'1px solid #e1e4e8',
  },
  newfield_button: {
    textAlign: 'right',
  },
  addfield: {
    // border:'1px solid #e1e4e8',
    flexGrow: 1,
    padding: theme.spacing(2),
  },
  settingtab: {
    backgroundColor: '#e1e4e8',
  },
}));

type ProjectInfoProps = {
  project_id: string;
  projectvalue: projectvalueType;
  setProjectValue: handlertype;
  handleSubmit: handlertype;
};

export default function ProjectInfoTab(props: ProjectInfoProps) {
  const {projectvalue, setProjectValue, project_id, ...others} = props;
  const [projectInfo, setProjectInfo] = useState<any>(
    getProjectInfo(project_id)
  );
  const handleChangeFormProject = (event: any) => {
    const newproject = projectvalue;
    newproject[event.target.name] = event.target.value;
    setProjectValue(newproject);
  };

  return (
    <>
      <FormForm
        uiSpec={getprojectform(['projectname'])}
        currentView="start-view"
        handleChangeForm={handleChangeFormProject}
        handleSubmit={props.handleSubmit}
      />
      <pre>{JSON.stringify(projectInfo, null, 2)}</pre>
    </>
  );
}
