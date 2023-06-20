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
 * Filename: loadingApp.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Grid,
  Container,
} from '@mui/material';
import SystemAlert from './alert';

export default function LoadingApp() {
  return (
    <Container maxWidth={false}>
      <Grid
        container
        spacing={0}
        alignItems="center"
        justifyContent="center"
        style={{marginTop: '5vh', minHeight: '50%'}}
      >
        <Grid item xs={8} sm={3} md={3}>
          <img
            src="/static/logo/Fieldmark-Portrait-Margin@4x.png"
            style={{maxWidth: '100%'}}
          />
        </Grid>
      </Grid>
      <Grid
        container
        spacing={0}
        alignItems="center"
        justifyContent="center"
        style={{minHeight: '50%'}}
      >
        <Grid item xs={8} sm={4}>
          <Box mb={1} mt={2}>
            <Typography variant="subtitle2" align={'center'}>
              <p>Loading data</p>
              <CircularProgress
                color={'primary'}
                size={'0.75rem'}
                thickness={5}
              />
            </Typography>
          </Box>
          <Box mb={2}>
            <Typography variant={'body2'} align={'center'}>
              This may take some time on first load, depending on your
              connection speed.
            </Typography>
          </Box>
        </Grid>
      </Grid>
      <SystemAlert />
    </Container>
  );
}
