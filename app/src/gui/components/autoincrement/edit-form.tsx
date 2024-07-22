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

import React from 'react';
import {Formik, Form, Field, yupToFormErrors} from 'formik';
import {
  ButtonGroup,
  Box,
  Alert,
  Button,
  LinearProgress,
  Grid,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {TextField} from 'formik-mui';
import * as yup from 'yup';

import {ActionType} from '../../../context/actions';
import {store} from '../../../context/store';
import {ProjectID, LocalAutoIncrementRange} from 'faims3-datamodel';
import {
  getLocalAutoincrementRangesForField,
  setLocalAutoincrementRangesForField,
  createNewAutoincrementRange,
} from '../../../local-data/autoincrement';

interface Props {
  project_id: ProjectID;
  form_id: string;
  field_id: string;
  label: string;
}

interface State {
  ranges: LocalAutoIncrementRange[] | null;
  ranges_initialised: boolean;
}

const FORM_SCHEMA = yup.object().shape({
  start: yup.number().required().positive().integer(),
  stop: yup.number().required().positive().integer(),
});

export default class BasicAutoIncrementer extends React.Component<
  Props,
  State
> {
  constructor(props: Props) {
    super(props);
    this.state = {
      ranges: null,
      ranges_initialised: false,
    };
  }

  async ensure_ranges() {
    if (this.state.ranges === null) {
      const ranges = await getLocalAutoincrementRangesForField(
        this.props.project_id,
        this.props.form_id,
        this.props.field_id
      );
      this.setState({ranges: ranges});
    }
  }

  async add_new_range() {
    await this.ensure_ranges();
    const ranges = [
      ...((this.state.ranges || []) as LocalAutoIncrementRange[]),
    ];
    ranges.push(createNewAutoincrementRange(0, 0));
    this.setState({ranges: ranges});
  }

  cloned_ranges(): LocalAutoIncrementRange[] | null {
    if (this.state.ranges === null) {
      return null;
    }
    // react requires us to make deep copied if we want to modify state...
    const ranges = [] as LocalAutoIncrementRange[];
    for (const old_range of this.state.ranges) {
      // This assumes we don't need to go another level down to deep clone
      const new_range = {...old_range};
      ranges.push(new_range);
    }
    return ranges;
  }

  render_ranges() {
    const ranges = this.cloned_ranges();
    if (ranges === null || ranges.length === 0) {
      return (
        <Alert severity={'info'} sx={{mb: 1}}>
          No ranges allocated yet.
        </Alert>
      );
    }
    return (
      <div>
        {ranges.map((range, range_index) => {
          return this.render_range(range, range_index, ranges);
        })}
      </div>
    );
  }

  async update_ranges(ranges: LocalAutoIncrementRange[]) {
    const {project_id, form_id, field_id} = this.props;
    try {
      await setLocalAutoincrementRangesForField(
        project_id,
        form_id,
        field_id,
        ranges
      ).then(() => {
        (this.context as any).dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Range successfully updated',
            severity: 'success',
          },
        });
      });
      let ranges_initialised = false;
      for (const range of ranges) {
        if (range.using || range.fully_used) {
          ranges_initialised = true;
          break;
        }
      }
      this.setState({ranges: ranges, ranges_initialised: ranges_initialised});
    } catch (err: any) {
      (this.context as any).dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: err.toString(),
          severity: 'error',
        },
      });
    }
  }

  render_range(
    range: LocalAutoIncrementRange,
    range_index: number,
    ranges: LocalAutoIncrementRange[]
  ) {
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
        key={range_index}
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
          await this.update_ranges(ranges).then(() => {
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

                        await this.update_ranges(ranges);
                      }}
                    >
                      Disable range
                    </Button>
                  ) : (
                    <Button
                      color="error"
                      data-testid="removeRangeBtn"
                      disabled={
                        range_count < 2 && this.state.ranges_initialised
                      }
                      onClick={async () => {
                        ranges.splice(range_index, 1);

                        await this.update_ranges(ranges);
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
  }

  async componentDidMount() {
    await this.ensure_ranges();
  }

  async componentDidUpdate() {
    await this.ensure_ranges();
  }

  render() {
    return (
      <Box mt={1}>
        {this.render_ranges()}
        <Button
          variant="outlined"
          color={'primary'}
          onClick={async () => {
            this.add_new_range();
          }}
          startIcon={<AddIcon />}
          data-testid="addNewRangeBtn"
        >
          Add new range
        </Button>
      </Box>
    );
  }
}
BasicAutoIncrementer.contextType = store;
