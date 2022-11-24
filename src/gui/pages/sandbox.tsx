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
  LinearProgress,
} from '@mui/material';
import TextField from '@mui/material/TextField';
import {NavLink} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {Formik, Form, Field} from 'formik';
import {DateTimeNow} from '../fields/DateTimeNow';
// import moment from 'moment/moment';

export function getLocalDate(value: Date) {
  /**
   * Return local time in yyyy-MM-ddTHH:mm:ss format by converting to ISO and shifting TZ
   *
   * Add the timezone offset and convert to an ISO date,
   * then strip the timezone with the substring(0, 16)
   */
  // getTimezoneOffset returns your local timezone offset in minutes
  const offset = value.getTimezoneOffset() * 1000 * 60; // convert to ms
  const offsetDate = new Date(value).valueOf() - offset; // (valueOf returns milliseconds)
  const date = new Date(offsetDate).toISOString();
  return date.substring(0, 19);
  // return moment(value).utcOffset(0, true).format('YYYY-MM-DDTHH:mm:ss');
}

export default function Sandbox() {
  const [now, setNow] = React.useState(new Date() as Date);
  const [value, setValue] = React.useState('');
  const [valueISO, setValueISO] = React.useState('');
  const dummyIsoString = '2020-02-13T22:00:35.736Z';

  const handleValues = (newValue: string) => {
    // set the value on the component, and the ISO string ready for submission
    setValue(newValue);
    setValueISO(new Date(newValue).toISOString());
  };

  const handleClick = () => {
    const now = new Date();
    setNow(now);
    handleValues(getLocalDate(now));
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleValues(event.target.value);
  };

  const handleLoadTZAwareISOValue = () => {
    handleValues(getLocalDate(new Date(dummyIsoString)));
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
            inputProps={{
              step: 1,
            }}
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
        now: {String(now)}
        <hr />
        input field value: {value}{' '}
        <small> ← Value used by datetime-local field</small>
        <hr />
        valueISO: {valueISO}
        <small> ← Output value to be saved in pouch/couchDB</small>
        <hr />
        <Button
          variant="outlined"
          disableElevation
          aria-label="capture time now from ISO string"
          onClick={handleLoadTZAwareISOValue}
        >
          Load {dummyIsoString}
        </Button>{' '}
        <small> ← Mock loading ISO string from DB </small>
      </Box>
      <Box component={Paper} variant={'outlined'} elevation={0} p={1} my={2}>
        <Typography variant={'caption'} gutterBottom sx={{mb: 1}}>
          Formik Form
        </Typography>

        <Formik
          initialValues={{
            datetime_test: '',
          }}
          onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              alert(JSON.stringify(values, null, 2));
            }, 500);
          }}
        >
          {({submitForm, isSubmitting}) => (
            <Form>
              <Field
                name="datetime_test"
                type="datetime-local"
                component={DateTimeNow}
              />
              {isSubmitting && <LinearProgress />}
              <br />
              <Button
                variant="contained"
                color="primary"
                disabled={isSubmitting}
                onClick={submitForm}
              >
                Submit
              </Button>
            </Form>
          )}
        </Formik>
      </Box>
    </Container>
  );
}
