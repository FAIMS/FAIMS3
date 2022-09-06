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
 * Filename: project-list.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Box, Grid} from '@mui/material';
import Breadcrumbs from '../components/ui/breadcrumbs';
import ProjectCard from '../components/project/card';
import * as ROUTES from '../../constants/routes';
import {getProjectList, listenProjectList} from '../../databaseAccess';
import {CircularProgress} from '@mui/material';
import {useEventedPromise} from '../pouchHook';
import {TokenContents} from '../../datamodel/core';

type ProjectProps = {
  token?: null | undefined | TokenContents;
};

export default function ProjectList(props: ProjectProps) {
  const pouchProjectList = useEventedPromise(
    getProjectList,
    listenProjectList,
    true,
    []
  ).expect();
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Home'},
    {title: 'Notebooks'},
  ];

  return (
    <Box>
      <Breadcrumbs data={breadcrumbs} />
      {pouchProjectList === null ? (
        <CircularProgress />
      ) : Object.keys(pouchProjectList).length === 0 ? (
        <span>No notebooks found</span>
      ) : (
        pouchProjectList.map(project_info => {
          const project_id = project_info.project_id;
          if (project_info !== null) {
            return (
              <Box key={'project-list' + project_id}>
                <ProjectCard project={project_info} dashboard={true} />
              </Box>
            );
          } else {
            return (
              <Box key={'project-list' + project_id}>
                Project could not be loaded
              </Box>
            );
          }
        })
      )}
    </Box>
  );
}
