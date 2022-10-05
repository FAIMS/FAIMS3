import React, {useContext} from 'react';
import {
  Button,
  Grid,
  Box,
  Paper,
  Typography,
  TextField,
  Autocomplete,
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import {ActionType} from '../../../../../context/actions';
import {store} from '../../../../../context/store';

export interface RelationshipType {
  link: string;
  reciprocal: string;
}
interface CreateRecordLinkProps {
  relationship_types: Array<RelationshipType>;
  record_hrid: string;
  record_type: string;
  field_label: string;
}
export function CreateRecordLink(props: CreateRecordLinkProps) {
  /**
   * Allow users to add a link to a record from the current record
   */
  const [relationship, setRelationship] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const options = ['Record 1', 'Record 2'];
  const [value, setValue] = React.useState<string | null>(options[0]);
  const [inputValue, setInputValue] = React.useState('');
  const {dispatch} = useContext(store);
  const handleChange = (event: SelectChangeEvent) => {
    setRelationship(event.target.value as string);
  };
  const handleSubmit = () => {
    /**
     * Submit relationship to couchDB
     * TODO replace setTimeout with actual request to couchDB
     */
    setSubmitting(true);
    // mimic sending request to couch
    const timer = setTimeout(() => {
      // reset local state of component
      setSubmitting(false);
      setRelationship('');
      setValue(options[0]);
      setInputValue('');

      // response error
      dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: `Link between record ${props.record_type} ${props.record_hrid} and ${value} could not be added. Contact support.`,
          severity: 'error',
        },
      });

      // response success
      dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: `Link between record ${props.record_type} ${props.record_hrid} and ${value} added`,
          severity: 'success',
        },
      });
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  };

  return (
    <Box
      component={Paper}
      elevation={0}
      variant={'outlined'}
      p={{xs: 1, sm: 1, md: 2}}
      sx={{width: '100%'}}
    >
      <Box>
        <Typography variant={'subtitle2'} sx={{mb: 1}}>
          Add a link from {props.record_type} {props.record_hrid}{' '}
          <strong>{props.field_label}</strong> to an existing record.
        </Typography>
      </Box>
      <Grid container spacing={1} direction="row" justifyContent="flex-start">
        <Grid item xs={12} sm={12} md={3} lg={3}>
          <FormControl fullWidth size={'small'}>
            <InputLabel id="demo-simple-select-label">Relationship</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="create-record-relationship-type"
              value={relationship}
              label="Relationship"
              onChange={handleChange}
            >
              {props.relationship_types.map(r => (
                <MenuItem value={r.link} key={r.link}>
                  {r.link}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={12} md={3} lg={3}>
          <Autocomplete
            fullWidth
            size={'small'}
            value={value}
            onChange={(event: any, newValue: string | null) => {
              setValue(newValue);
            }}
            inputValue={inputValue}
            onInputChange={(event, newInputValue) => {
              setInputValue(newInputValue);
            }}
            id="create-record-relationship-record"
            options={options}
            renderInput={params => <TextField {...params} label="Record" />}
          />
        </Grid>
        <Grid
          item
          xs={12}
          sm={12}
          md={1}
          lg={1}
          alignItems={'stretch'}
          style={{display: 'flex'}}
        >
          {submitting ? (
            <LoadingButton
              loading
              variant={'contained'}
              fullWidth
              size={'medium'}
            />
          ) : (
            <Button
              variant={'contained'}
              disableElevation
              fullWidth
              size={'medium'}
              onClick={handleSubmit}
            >
              Link
            </Button>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
