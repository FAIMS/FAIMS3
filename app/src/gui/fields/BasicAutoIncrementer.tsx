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
 * Filename: BasicAutoIncrementer.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import Input from '@mui/material/Input';
import {FieldProps} from 'formik';
import {ActionType} from '../../context/actions';
import {store} from '../../context/store';
import {
  getLocalAutoincrementStateForField,
  setLocalAutoincrementStateForField,
} from '../../local-data/autoincrement';

import {
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
interface Props {
  num_digits: number;
  // This could be dropped depending on how multi-stage forms are configured
  form_id: string;
  label?: string;
}

interface State {
  has_run: boolean;
  is_ranger: boolean;
  label: string;
}

function AddRangeDialog() {
  const [open, setOpen] = React.useState(false);
  return (
    <Grid container>
      <Button
        onClick={() => setOpen(true)}
        color={'error'}
        variant={'text'}
        disableElevation={true}
      >
        Add Range
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Information</DialogTitle>
        <DialogContent style={{width: '600px', height: '100px'}}>
          <DialogContentText id="alert-dialog-description">
            {
              'Go to Notebook > Settings Tab > Edit Allocations to Add New Range'
            }{' '}
            <br />
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}

export class BasicAutoIncrementer extends React.Component<
  FieldProps & Props,
  State
> {
  constructor(props: FieldProps & Props) {
    super(props);
    const label =
      this.props.label !== '' && this.props.label !== undefined
        ? this.props.label
        : this.props.form_id;
    this.state = {
      has_run: false,
      is_ranger: true,
      label: label ?? this.props.form_id,
    };
  }

  async get_id(): Promise<number | null> {
    const project_id = this.props.form.values['_project_id'];
    const form_id = this.props.form_id;
    const field_id = this.props.field.name;
    const local_state = await getLocalAutoincrementStateForField(
      project_id,
      form_id,
      field_id
    );
    console.debug(
      `local_auto_inc for ${project_id} ${form_id} ${field_id} is`,
      local_state
    );
    if (local_state.last_used_id === null && local_state.ranges.length === 0) {
      // We have no range allocations, block
      // TODO: add link to range allocation
      (this.context as any).dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message:
            'No ranges exist for this notebook yet. Go to the notebook Settings tab to add/edit ranges.',
          severity: 'error',
        },
      });
      this.setState({...this.state, is_ranger: false});
      return null;
    }
    if (local_state.last_used_id === null) {
      console.debug('local_auto_inc starting with clean slate');
      // We've got a clean slate with ranges allocated, start allocating ids
      const new_id = local_state.ranges[0].start;
      local_state.ranges[0].using = true;
      local_state.last_used_id = new_id;
      await setLocalAutoincrementStateForField(local_state);
      return new_id;
    }
    // We're now using the allocated ranges, find where we've up to:
    // If we're using a range, find it
    for (const range of local_state.ranges) {
      if (range.using) {
        if (local_state.last_used_id + 1 < range.stop) {
          console.debug('local_auto_inc using existing range', range);
          const next_id = local_state.last_used_id + 1;
          local_state.last_used_id = next_id;
          await setLocalAutoincrementStateForField(local_state);
          return next_id;
        }
        range.fully_used = true;
        range.using = false;
        console.debug('local_auto_inc finished with range', range);
      }
    }
    // find a new range to use
    for (const range of local_state.ranges) {
      if (!range.fully_used) {
        const next_id = range.start;
        range.using = true;
        local_state.last_used_id = next_id;
        console.debug('local_auto_inc staring with range', range);
        await setLocalAutoincrementStateForField(local_state);
        return next_id;
      }
    }
    // we've got no new ranges to use, either we block, or use the highest range
    // as a starting point
    // TODO: Add blocking logic
    let max_stop = local_state.last_used_id;
    for (const range of local_state.ranges) {
      if (range.stop > max_stop) {
        max_stop = range.stop;
      }
    }
    if (max_stop === local_state.last_used_id) {
      max_stop = max_stop + 1;
    }
    local_state.last_used_id = max_stop;
    await setLocalAutoincrementStateForField(local_state);
    console.debug('local_auto_inc using overrun', local_state);
    return max_stop;
  }

  async compute_id(num_digits: number): Promise<string | undefined> {
    const new_id = await this.get_id();
    if (new_id === null || new_id === undefined) {
      return undefined;
    }
    return new_id.toString().padStart(num_digits, '0');
  }

  async update_form() {
    const current_value = this.props.form.values[this.props.field.name];

    if (!this.state.has_run) {
      this.setState({has_run: true});
      console.debug('running autoinc');
      if (current_value === null) {
        const new_id = await this.compute_id(this.props.num_digits || 4);
        if (new_id === undefined) {
          (this.context as any).dispatch({
            type: ActionType.ADD_ALERT,
            payload: {
              message: 'Failed to get autoincremented ID',
              severity: 'error',
            },
          });
        } else {
          this.props.form.setFieldValue(this.props.field.name, new_id);
          if (this.props.form.errors[this.props.field.name] !== undefined)
            this.props.form.setFieldError(this.props.field.name, undefined);
        }
      } else {
        if (this.props.form.errors[this.props.field.name] !== undefined)
          this.props.form.setFieldError(this.props.field.name, undefined);
      }
    }
  }

  async componentDidMount() {
    console.debug('did mount', this.props.form.values[this.props.field.name]);
    await this.update_form();
  }
  // remove the update for form, should only be update once
  // async componentDidUpdate() {
  //   console.debug('did update',this.props.form.values[this.props.field.name])
  //   await this.update_form();
  // }

  render() {
    return (
      <>
        <Input
          name={this.props.field.name}
          id={this.props.field.name}
          readOnly={true}
          type={'hidden'}
        />
        {this.state.is_ranger === false && <AddRangeDialog />}
      </>
    );
  }
}

BasicAutoIncrementer.contextType = store;

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'BasicAutoIncrementer',
//   'type-returned': 'faims-core::String', // matches a type in the Project Model
//   'component-parameters': {
//     name: 'basic-autoincrementer-field',
//     id: 'basic-autoincrementer-field',
//     variant: 'outlined',
//     required: true,
//     num_digits: 5,
//     form_id: 'default', // TODO: sort out this
//     label: 'Auto Increase Range',
//   },
//   validationSchema: [['yup.string'], ['yup.required']],
//   initialValue: null,
// };
