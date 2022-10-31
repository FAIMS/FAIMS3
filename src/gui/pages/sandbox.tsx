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
 * Filename: sandbox.tsx
 * Description:
 *   TODO
 */

import React from 'react';
// import {makeStyles} from '@mui/material/styles';
import {
  Box,
  Stack,
  Breadcrumbs,
  Typography,
  Paper,
  Button,
  Container,
} from '@mui/material';
import TextField from '@mui/material/TextField';
import {NavLink} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';

export default function Sandbox() {
  const handleClick = () => {
    /**
     * Add the timezone offset and convert to an ISO date,
     * then strip the timezone with the substring(0, 16)
     */

    const now = new Date();
    // getTimezoneOffset returns your local timezone offset in minutes
    const offset = now.getTimezoneOffset() * 1000 * 60; // convert to ms
    const getLocalDate = (value: Date) => {
      const offsetDate = new Date(value).valueOf() - offset; // (valueOf returns milliseconds)
      const date = new Date(offsetDate).toISOString();
      return date.substring(0, 16);
    };
    setValue(getLocalDate(now));
  };
  const [value, setValue] = React.useState('');
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };
  return (
    <Container maxWidth={false}>
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.INDEX}>Home</NavLink>
          <Typography color="textPrimary">Sandbox</Typography>
        </Breadcrumbs>
      </Box>

      <Box
        component={Paper}
        variant={'outlined'}
        elevation={0}
        px={1}
        py={2}
        my={2}
      >
        <Stack direction={{xs: 'column', sm: 'row'}} spacing={{xs: 1, sm: 0}}>
          <TextField
            id="datetime-stamp"
            label="datetime-stamp with now button"
            type="datetime-local"
            sx={{
              minWidth: 250,
              '& .MuiOutlinedInput-root': {borderRadius: '4px 0px 0px 4px'},
            }}
            value={value}
            onChange={handleChange}
            InputLabelProps={{
              shrink: true,
            }}
          />
          <Button
            variant="contained"
            disableElevation
            aria-label="capture time now"
            onClick={handleClick}
            sx={{
              borderRadius: {xs: '4px', sm: '0px 4px 4px 0px'},
            }}
          >
            Now
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}
