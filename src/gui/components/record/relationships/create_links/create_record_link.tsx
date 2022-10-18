import React, {useContext} from 'react';
import {
  Button,
  Grid,
  Box,
  Paper,
  Typography,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import {ActionType} from '../../../../../context/actions';
import {store} from '../../../../../context/store';
import {RecordReference} from '../../../../../datamodel/ui';
import {Field} from 'formik';
export interface RelationshipType {
  link: string;
  reciprocal: string;
}
// interface CreateRecordLinkProps {
//   relationship_types: Array<RelationshipType>;
//   record_hrid: string;
//   record_type: string;
//   field_label: string;
// }
type CreateRecordLinkProps = any;
export function CreateRecordLink(props: CreateRecordLinkProps) {
  /**
   * Allow users to add a link to a record from the current record
   */
  const [submitting, setSubmitting] = React.useState(false);

  const {dispatch} = useContext(store);

  const {
    field_name,
    options,
    handleChange,
    relationshipLabel,
    SetSelectedRecord,
    selectedRecord,
    disabled,
  } = props;

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
      props.add_related_child();

      // // response error
      // dispatch({
      //   type: ActionType.ADD_ALERT,
      //   payload: {
      //     message: `Link between record ${props.record_type} ${props.record_hrid} and ${selectedRecord.record_label} could not be added. Contact support.`,
      //     severity: 'error',
      //   },
      // });

      // response success
      dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: `Link between record ${props.record_type} ${props.record_hrid} and ${selectedRecord.record_label} added`,
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
        {props.relation_type === 'Linked' &&
          props.relation_linked_vocabPair !== undefined && (
            <Grid item xs={12} sm={12} md={3} lg={3}>
              <FormControl fullWidth size={'small'}>
                <InputLabel id="demo-simple-select-label">
                  Relationship
                </InputLabel>
                <Select
                  labelId={'demo-simple-select-label' + field_name}
                  id={'create-record-relationship-type' + field_name}
                  value={relationshipLabel}
                  label="Relationship"
                  onChange={handleChange}
                  name={'create-relation-type' + field_name}
                >
                  {props.relation_linked_vocabPair.map(
                    (r: string[], index: number) => (
                      <MenuItem value={r[0]} key={index}>
                        {r[0]}
                      </MenuItem>
                    )
                  )}
                </Select>
              </FormControl>
            </Grid>
          )}
        <Grid
          item
          xs={12}
          sm={12}
          md={props.relation_type === 'Linked' ? 3 : 6}
          lg={props.relation_type === 'Linked' ? 3 : 6}
        >
          <Field
            size={'small'}
            // multiple={multiple}
            id={props.id ?? 'asynchronous-demo'}
            name={field_name + 'select'}
            component={Autocomplete}
            isOptionEqualToValue={(
              option: RecordReference,
              value: RecordReference
            ) =>
              value !== undefined
                ? option.project_id === value.project_id &&
                  option.record_id === value.record_id
                : false
            }
            getOptionLabel={(option: RecordReference) =>
              option.record_label ?? ''
            }
            options={options}
            defaultValue={undefined}
            disabled={disabled}
            onChange={(event: any, values: any) => {
              SetSelectedRecord(values);
            }}
            value={selectedRecord}
            required={false}
            renderInput={(params: any) => (
              <TextField
                {...params}
                label={props.InputLabelProps.label}
                error={props.form.errors[props.id] === undefined ? false : true}
                variant="outlined"
                InputProps={{
                  ...params.InputProps,
                }}
              />
            )}
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
