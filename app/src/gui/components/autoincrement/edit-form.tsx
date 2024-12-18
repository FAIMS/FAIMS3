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
import {useContext, useState} from 'react';

import {LocalAutoIncrementRange, ProjectID} from '@faims3/data-model';
import CloseIcon from '@mui/icons-material/Close';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ActionType} from '../../../context/actions';
import {store, useAppDispatch} from '../../../context/store';
import {
  createNewAutoincrementRange,
  getLocalAutoincrementRangesForField,
  setLocalAutoincrementRangesForField,
} from '../../../local-data/autoincrement';

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
  const dispatch = useAppDispatch();

  // useQuery to get the current ranges for the field,
  // we will invalidate the query when we update the ranges
  // so that they get re-fetched
  const queryClient = useQueryClient();
  const queryKey = ['autoincrement', project_id, form_id, field_id];
  const {data: ranges} = useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      const ranges = await getLocalAutoincrementRangesForField(
        project_id,
        form_id,
        field_id
      );
      return ranges;
    },
    initialData: [],
    enabled: true,
  });

  const addNewRange = async () => {
    const updatedRanges = [...(ranges || [])];
    updatedRanges.push(createNewAutoincrementRange(0, 0));
    updateRanges(updatedRanges);
  };

  const updateRanges = async (newRanges: LocalAutoIncrementRange[]) => {
    try {
      await setLocalAutoincrementRangesForField(
        project_id,
        form_id,
        field_id,
        newRanges
      );
      queryClient.invalidateQueries({queryKey: queryKey});
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

  const updateRange = (index: number) => {
    return (range: LocalAutoIncrementRange) => {
      const rangesCopy = [...ranges];
      rangesCopy[index] = range;
      updateRanges(rangesCopy);
    };
  };

  const handleRemoveRange = (index: number) => {
    const newRanges = ranges?.filter((_, i) => i !== index);
    if (newRanges !== undefined) {
      updateRanges(newRanges);
    } else {
      updateRanges([]);
    }
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
          {ranges?.map((range, index) => {
            return (
              <IncrementerRange
                key={index}
                range={range}
                index={index}
                updateRange={updateRange(index)}
                handleRemoveRange={handleRemoveRange}
                allowRemove={ranges.length > 1}
              />
            );
          })}
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
  const [start, setStart] = useState(props.range.start);
  const [stop, setStop] = useState(props.range.stop);

  const handleStartChange = (event: any) => {
    const newStart = parseInt(event.target.value);
    if (newStart >= 0) {
      setStart(newStart);
      if (newStart >= props.range.stop) {
        // initialise a range of 100 if they enter a start > stop
        setStop(newStart + 100);
        props.updateRange({
          ...props.range,
          start: newStart,
          stop: newStart + 100,
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
