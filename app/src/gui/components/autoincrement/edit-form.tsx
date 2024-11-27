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
 * Filename: form.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useEffect, useState} from 'react';
import {Formik, Form, Field, yupToFormErrors} from 'formik';
import {
  ButtonGroup,
  Box,
  Alert,
  Button,
  LinearProgress,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  Typography,
  IconButton,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {TextField} from 'formik-mui';
import * as yup from 'yup';

import {ActionType} from '../../../context/actions';
import {store} from '../../../context/store';
import {ProjectID, LocalAutoIncrementRange} from '@faims3/data-model';
import {
  getLocalAutoincrementRangesForField,
  setLocalAutoincrementRangesForField,
  createNewAutoincrementRange,
} from '../../../local-data/autoincrement';
import CloseIcon from '@mui/icons-material/Close';
import {all} from 'ol/events/condition';

interface Props {
  project_id: ProjectID;
  form_id: string;
  field_id: string;
  label: string;
  open: boolean;
  handleClose: () => void;
}

interface State {
  ranges: LocalAutoIncrementRange[] | null;
  ranges_initialised: boolean;
}

const FORM_SCHEMA = yup.object().shape({
  start: yup.number().required().positive().integer(),
  stop: yup.number().required().positive().integer(),
});

export const AutoIncrementEditForm = ({
  project_id,
  form_id,
  field_id,
  label,
  open,
  handleClose,
}: Props) => {
  const [ranges, setRanges] = useState<LocalAutoIncrementRange[] | null>(null);
  const [rangesInitialised, setRangesInitialised] = useState(false);
  const {dispatch} = useContext(store);

  const ensureRanges = async () => {
    if (ranges === null) {
      const fetchedRanges = await getLocalAutoincrementRangesForField(
        project_id,
        form_id,
        field_id
      );
      setRanges(fetchedRanges);
    }
  };

  const addNewRange = async () => {
    await ensureRanges();
    const updatedRanges = [...(ranges || [])];
    updatedRanges.push(createNewAutoincrementRange(0, 0));
    setRanges(updatedRanges);
  };

  const clonedRanges = (): LocalAutoIncrementRange[] | null => {
    if (ranges === null) return null;
    return ranges.map(range => ({...range}));
  };

  const updateRanges = async (newRanges: LocalAutoIncrementRange[]) => {
    try {
      await setLocalAutoincrementRangesForField(
        project_id,
        form_id,
        field_id,
        newRanges
      );
      dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Range successfully updated',
          severity: 'success',
        },
      });

      const isInitialised = newRanges.some(
        range => range.using || range.fully_used
      );
      setRanges(newRanges);
      setRangesInitialised(isInitialised);
    } catch (err: any) {
      dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: err.toString(),
          severity: 'error',
        },
      });
    }
  };

  const renderRange = (
    range: LocalAutoIncrementRange,
    rangeIndex: number,
    ranges: LocalAutoIncrementRange[]
  ) => {
    const range_count = ranges.length;
    const start_props = {
      id: 'start',
      label: 'start',
      name: 'start',
      required: true,
      type: 'number',
      readOnly: range.using || range.fully_used,
      disabled: range.using || range.fully_used,
    };
    const stop_props = {
      id: 'stop',
      label: 'stop',
      name: 'stop',
      required: true,
      type: 'number',
      readOnly: range.fully_used,
      disabled: range.fully_used,
    };

    return (
      <Formik
        key={rangeIndex}
        initialValues={{
          start: range.start,
          stop: range.stop,
        }}
        validate={values => {
          return FORM_SCHEMA.validate(values)
            .then(v => {
              if (!(v.stop > v.start)) {
                return {stop: 'Must be greater than start'};
              }
              return {};
            })
            .catch(err => {
              return yupToFormErrors(err);
            });
        }}
        onSubmit={async (values, {setSubmitting}) => {
          range.start = values.start;
          range.stop = values.stop;
          await updateRanges(ranges).then(() => {
            setSubmitting(false);
          });
        }}
      >
        {({submitForm, isSubmitting}) => (
          <Box sx={{my: 1}} data-testid="rangeBox">
            <Form data-testid="addRangeForm">
              <Grid container direction="row" spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Field
                    size={'small'}
                    component={TextField}
                    data-testid="rangeStart"
                    {...start_props}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    size={'small'}
                    component={TextField}
                    data-testid="rangeStop"
                    {...stop_props}
                  />
                </Grid>
              </Grid>

              <Grid item xs>
                <ButtonGroup
                  fullWidth={true}
                  sx={{mt: 1}}
                  variant={'outlined'}
                  size={'small'}
                >
                  {range.using ? (
                    <Button
                      color="error"
                      onClick={async () => {
                        range.fully_used = true;

                        await updateRanges(ranges);
                      }}
                    >
                      Disable range
                    </Button>
                  ) : (
                    <Button
                      color="error"
                      data-testid="removeRangeBtn"
                      disabled={range_count < 2 && rangesInitialised}
                      onClick={async () => {
                        ranges.splice(rangeIndex, 1);

                        await updateRanges(ranges);
                      }}
                    >
                      Remove range
                    </Button>
                  )}
                  <Button
                    color="primary"
                    disabled={isSubmitting || range.fully_used}
                    onClick={submitForm}
                  >
                    Update range
                  </Button>
                </ButtonGroup>
              </Grid>
            </Form>
            {isSubmitting && <LinearProgress />}
            <Divider sx={{mt: 1, mb: 2}} />
          </Box>
        )}
      </Formik>
    );
  };

  const renderRanges = () => {
    const currentRanges = clonedRanges();

    const all_used = currentRanges?.every(
      (range: LocalAutoIncrementRange) => range.fully_used
    );

    if (currentRanges === null || currentRanges.length === 0) {
      return (
        <Alert severity={'info'} sx={{mb: 1}}>
          No ranges allocated yet.
        </Alert>
      );
    }

    return (
      <div>
        {all_used && (
          <Alert severity={'error'} sx={{mb: 1}}>
            All ranges are fully used. Please add a new range.
          </Alert>
        )}
        {currentRanges.map((range, index) =>
          renderRange(range, index, currentRanges)
        )}
      </div>
    );
  };

  useEffect(() => {
    ensureRanges();
  }, []);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Edit Settings for {label}</DialogTitle>
      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
        }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent dividers>
        <Typography gutterBottom>
          This form uses an auto-increment field to generate new identifiers for
          each record. Here you can set a range of numbers to use on this
          device.
        </Typography>
        <Typography gutterBottom>
          Set a start and end for the range, numbers will be allocated in order
          until used up. You must add at least one range. If there is more than
          one range, the ranges will be used in order.
        </Typography>
        <Divider sx={{mt: 1, mb: 2}} />

        {renderRanges()}

        <DialogActions>
          <Button
            variant="contained"
            color={'primary'}
            onClick={addNewRange}
            startIcon={<AddIcon />}
            data-testid="addNewRangeBtn"
          >
            Add new range
          </Button>
          <Button
            variant="outlined"
            color={'primary'}
            onClick={handleClose}
            data-testid="closeDialogBtn"
          >
            Done
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};
