import React, {useContext} from 'react';
import {
  Button,
  Grid,
  TextField,
  Autocomplete,
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import {ActionType} from '../../../../context/actions';
import {store} from '../../../../context/store';

export interface RelationshipType {
  link: string;
  reciprocal: string;
}
interface CreateRecordLinkProps {
  relationships: Array<RelationshipType>;
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
          message:
            'Relationship between record A and B could not be added. Contact support.',
          severity: 'error',
        },
      });

      // response success
      dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Relationship between record A and B added',
          severity: 'success',
        },
      });
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  };

  return (
    <Grid container spacing={1} direction="row" justifyContent="space-between">
      <Grid item xs={12} sm={5} md={4}>
        <FormControl fullWidth>
          <InputLabel id="demo-simple-select-label">Relationship</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="create-record-relationship-type"
            value={relationship}
            label="Relationship"
            onChange={handleChange}
          >
            {props.relationships.map(r => (
              <MenuItem value={r.link} key={r.link}>
                {r.link}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={5} md={6}>
        <Autocomplete
          fullWidth
          value={value}
          onChange={(event: any, newValue: string | null) => {
            setValue(newValue);
          }}
          inputValue={inputValue}
          onInputChange={(event, newInputValue) => {
            setInputValue(newInputValue);
          }}
          id="create-record-relationship-records"
          options={options}
          renderInput={params => <TextField {...params} label="Record" />}
        />
      </Grid>
      <Grid
        item
        xs={12}
        sm={2}
        md={2}
        alignItems="stretch"
        style={{display: 'flex'}}
      >
        {submitting ? (
          <LoadingButton
            loading
            variant={'contained'}
            fullWidth
            size={'large'}
          />
        ) : (
          <Button
            variant={'contained'}
            disableElevation
            fullWidth
            size={'large'}
            onClick={handleSubmit}
          >
            Add
          </Button>
        )}
      </Grid>
    </Grid>
  );
}
