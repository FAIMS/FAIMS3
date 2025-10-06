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
 *   Defines a form for editing the auto-incrementer ranges for a field
 */

import AddIcon from '@mui/icons-material/Add';
import {
  Badge,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {useEffect, useState} from 'react';

import {ProjectID} from '@faims3/data-model';
import CloseIcon from '@mui/icons-material/Close';
import {addAlert} from '../../../context/slices/alertSlice';
import {useAppDispatch} from '../../../context/store';
import {AutoIncrementer} from '../../../local-data/autoincrement';
import {
  LocalAutoIncrementRange,
  LocalAutoIncrementState,
} from '../../../local-data/autoincrementTypes';

interface Props {
  project_id: ProjectID;
  form_id: string;
  field_id: string;
  label: string;
  open: boolean;
  handleClose: () => void;
}

export const AutoIncrementEditForm = ({
  project_id,
  form_id,
  field_id,
  label,
  open,
  handleClose,
}: Props) => {
  const [state, setState] = useState<LocalAutoIncrementState>();
  const refreshState = async () => {
    const state = await incrementer.getState();
    setState(state);
  };

  useEffect(() => {
    refreshState();
  }, []);

  const dispatch = useAppDispatch();

  const incrementer = new AutoIncrementer(project_id, form_id, field_id);

  const errorHandler = (error: Error) => {
    dispatch(
      addAlert({
        message: error.toString(),
        severity: 'error',
      })
    );
  };

  const updateRange =
    (index: number) => async (range: LocalAutoIncrementRange) => {
      await incrementer.updateRange(index, range).catch(errorHandler);
      await refreshState();
    };

  const removeRange = async (index: number) => {
    console.log('Removing range', index);
    await incrementer.removeRange(index).catch(errorHandler);
    refreshState();
  };

  const addNewRange = async () => {
    await incrementer.addRange({start: 0, stop: 0}).catch(errorHandler);
    refreshState();
  };

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

        <Stack direction="column" spacing={2}>
          <TextField
            label="Current Value"
            value={state?.last_used_id ?? 'No value set'}
            disabled={true}
          />
          {state?.ranges?.map(
            (range: LocalAutoIncrementRange, index: number) => {
              return (
                <IncrementerRange
                  key={index}
                  range={range}
                  index={index}
                  updateRange={updateRange(index)}
                  handleRemoveRange={removeRange}
                  allowRemove={state.ranges.length > 1}
                />
              );
            }
          )}
          <Button
            variant="outlined"
            color={'primary'}
            onClick={addNewRange}
            startIcon={<AddIcon />}
            data-testid="addNewRangeBtn"
          >
            Add new range
          </Button>
        </Stack>

        <DialogActions>
          <Button
            variant="contained"
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

type IncremenenterRangeProps = {
  range: LocalAutoIncrementRange;
  index: number;
  allowRemove: boolean;
  updateRange: (range: LocalAutoIncrementRange) => void;
  handleRemoveRange: (index: number) => void;
};

/**
 * A component to display and allow editing of a single range of auto-increment
 *
 * @param props component props
 */
const IncrementerRange = (props: IncremenenterRangeProps) => {
  const [start, setStart] = useState<number | string>(props.range.start);
  const [stop, setStop] = useState<number | string>(props.range.stop);

  // need to force reset when props change to ensure we update when
  // a range is deleted
  useEffect(() => {
    setStart(props.range.start);
    setStop(props.range.stop);
  }, [props.range.start, props.range.stop]);

  const handleStartChange = (event: any) => {
    if (event.target.value === '') {
      // set start but don't update the range
      setStart('');
      return;
    }
    const newStart = parseInt(event.target.value);
    if (newStart >= 0) {
      setStart(newStart);
      if (newStart >= props.range.stop) {
        // initialise a range of 100 if they enter a start > stop
        setStop(newStart + 99);
        props.updateRange({
          ...props.range,
          start: newStart,
          stop: newStart + 99,
        });
      } else {
        props.updateRange({
          ...props.range,
          start: newStart,
        });
      }
    }
  };

  const handleStopChange = (event: any) => {
    if (event.target.value === '') {
      // set stop but don't update the range
      setStop('');
      return;
    }
    const newStop = parseInt(event.target.value);
    if (newStop > props.range.start) {
      setStop(newStop);
      props.updateRange({
        ...props.range,
        stop: newStop,
      });
    }
  };

  const handleDisableRange = () => {
    props.updateRange({
      ...props.range,
      fully_used: true,
    });
  };

  return (
    <Badge badgeContent={props.range.using ? 'in use' : 0} color="primary">
      <Stack direction="row" spacing={2}>
        <TextField
          id={`rangeStart-${props.index}`}
          value={start}
          label="Start"
          type="number"
          size="small"
          sx={{maxWidth: '7em', minWidth: '2em'}}
          onChange={handleStartChange}
          disabled={props.range.using || props.range.fully_used}
        />
        <TextField
          id={`rangeStop-${props.index}`}
          value={stop}
          label="Stop"
          type="number"
          size="small"
          sx={{maxWidth: '7em'}}
          onChange={handleStopChange}
          disabled={props.range.fully_used}
        />
        <ButtonGroup
          fullWidth={true}
          sx={{mt: 1}}
          variant={'outlined'}
          size={'small'}
        >
          {props.range.using && (
            <Button color="error" onClick={handleDisableRange}>
              Disable range
            </Button>
          )}

          {!(props.range.using || props.range.fully_used) && (
            <Button
              color="error"
              data-testid="removeRangeBtn"
              disabled={!props.allowRemove}
              onClick={() => props.handleRemoveRange(props.index)}
            >
              Remove range
            </Button>
          )}
          {props.range.fully_used && (
            <Button color="error" disabled>
              Range fully used
            </Button>
          )}
        </ButtonGroup>
      </Stack>
    </Badge>
  );
};
