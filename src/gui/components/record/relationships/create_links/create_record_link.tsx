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
import AddIcon from '@mui/icons-material/Add';
import {Link} from 'react-router-dom';
import {CreateRecordLinkProps} from '../types';

export function AddNewRecordButton(props: {
  is_enabled: boolean;
  create_route: string;
  text: string;
}) {
  return (
    <Button
      variant="outlined"
      color="primary"
      startIcon={<AddIcon />}
      component={Link}
      disabled={!props.is_enabled}
      to={props.create_route}
    >
      {props.text}
    </Button>
  );
}
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
    project_id,
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
        {project_id !== undefined && disabled === false && (
          <Grid
            item
            xs={12}
            sm={12}
            md={props.relation_type === 'Linked' ? 3 : 1}
            lg={props.relation_type === 'Linked' ? 3 : 1}
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
              <>
                <Button
                  variant={'contained'}
                  disableElevation
                  fullWidth={props.relation_type === 'Linked' ? false : true}
                  onClick={handleSubmit}
                  disabled={!props.is_enabled}
                  style={{marginRight: '5px'}}
                >
                  Link
                </Button>
                {props.relation_type === 'Linked' && (
                  <AddNewRecordButton
                    is_enabled={props.is_enabled}
                    create_route={props.create_route}
                    text={'Add Record'}
                  />
                )}
              </>
            )}
          </Grid>
        )}
        {project_id !== undefined &&
          disabled === false &&
          !props.is_enabled && ( //update for eid or view
            <Grid
              item
              xs={12}
              sm={12}
              md={2}
              lg={2}
              alignItems={'stretch'}
              style={{display: 'flex'}}
            >
              <Typography variant="caption">
                {' '}
                To enable Add record or Link, remove link firstly
              </Typography>
            </Grid>
          )}
      </Grid>
    </Box>
  );
}
