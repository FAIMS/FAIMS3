/* eslint-disable n/no-extraneous-import */
// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {TabContext, TabList} from '@mui/lab';
import {Box, Tab} from '@mui/material';
import {Link, Outlet, useLocation} from 'react-router-dom';

export const NotebookEditor = () => {
  const {pathname} = useLocation();

  const tabIndex = pathname.startsWith('/design/')
    ? pathname.split('/')[2]
    : '0';

  return (
    <>
      <Box p={3}>
        <Box pt={0}>
          <TabContext value={pathname}>
            <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
              <TabList aria-label="lab API tabs example">
                <Tab
                  label="Design"
                  component={Link}
                  to={`/design/${tabIndex}`}
                  value={`/design/${tabIndex}`}
                />
                <Tab label="Info" component={Link} to="/info" value="/info" />
              </TabList>
            </Box>
            <Box p={3}>
              <Outlet />
            </Box>
          </TabContext>
        </Box>
      </Box>
    </>
  );
};
