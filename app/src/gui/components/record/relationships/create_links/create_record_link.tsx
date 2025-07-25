import {RecordReference, RevisionID} from '@faims3/data-model';
import AddIcon from '@mui/icons-material/Add';
import LoadingButton from '@mui/lab/LoadingButton';
import {
  Autocomplete,
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {Field} from 'formik';
import React from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../../../constants/routes';
import {addAlert} from '../../../../../context/slices/alertSlice';
import {useAppDispatch} from '../../../../../context/store';
import {logError} from '../../../../../logging';
import {LocationState} from '../RelatedInformation';
import {CreateRecordLinkProps} from '../types';

export function AddNewRecordButton(props: {
  is_enabled: boolean;
  pathname: string;
  state: LocationState;
  text: string;
  handleSubmit: () => Promise<RevisionID>;
  project_id: string;
  serverId: string;
  save_new_record: Function;
  handleError: Function;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const history = useNavigate();
  const dispatch = useAppDispatch();
  const handleSubmit = () => {
    setSubmitting(true);
    // here we make a new record id for the child and populate the form with the
    // relation information
    const childRecordId = props.save_new_record();
    if (props.handleSubmit !== undefined) {
      props
        .handleSubmit()
        .then((revisionID: RevisionID) => {
          const newState = props.state;
          newState['parent_link'] = ROUTES.getExistingRecordRoute({
            serverId: props.serverId,
            projectId: props.project_id,
            recordId: (props.state.parent_record_id || '').toString(),
            revisionId: (revisionID || '').toString(),
          });
          newState['child_record_id'] = childRecordId;
          // wait for 300ms and then jump to the new pathname with the new state
          setTimeout(() => {
            // reset local state of component
            setSubmitting(false);
            history(props.pathname, {state: newState});
          }, 300);
        })
        .catch((error: Error) => {
          logError(error);
          dispatch(
            addAlert({
              message: 'Error saving this record before adding a link.',
              severity: 'error',
            })
          );
          // so that the display resets and we don't have a spinner
          setSubmitting(false);
          if (props.handleError !== undefined)
            props.handleError(childRecordId, childRecordId);
        });
    }
  };
  return submitting ? (
    <LoadingButton loading variant={'contained'} size={'medium'}>
      Working...
    </LoadingButton>
  ) : (
    <Button
      variant="outlined"
      color="primary"
      startIcon={<AddIcon />}
      disabled={!props.is_enabled}
      onClick={() => handleSubmit()}
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
  const dispatch = useAppDispatch();

  const {
    field_name,
    relatedRecords,
    serverId,
    handleChange,
    SetSelectedRecord,
    selectedRecord,
    disabled,
    project_id,
  } = props;

  // default relationship to the first option
  const relationshipLabel =
    props.relationshipLabel || props.relation_linked_vocabPair[0][1];

  const handleSubmit = () => {
    /**
     * Submit relationship to couchDB
     * TODO replace setTimeout with actual request to couchDB
     *
     * Peter B: what the hell is going on here?? This is cooked.
     */
    setSubmitting(true);
    if (props.add_related_child !== undefined) {
      props.add_related_child();
    }

    // mimic sending request to couch
    const timer = setTimeout(() => {
      // reset local state of component
      setSubmitting(false);
      // setSubmitting(false);
      // if (props.handleReset !== undefined) props.handleReset();

      // // response error
      // dispatch({
      //   type: ActionType.ADD_ALERT,
      //   payload: {
      //     message: `Link between record ${props.record_type} ${props.record_hrid} and ${selectedRecord.record_label} could not be added. Contact support.`,
      //     severity: 'error',
      //   },
      // });
      try {
        // response success
        dispatch(
          addAlert({
            message: `Link between this record ${props.label} and ${selectedRecord.record_label} added`,
            severity: 'success',
          })
        );
      } catch (error) {
        logError(error);
      }
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
                      <MenuItem value={r[1]} key={index}>
                        {r[1]}
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
          <Field name={field_name + '-select'}>
            {({field, form}: any) => (
              <Autocomplete
                size={'small'}
                id={props.id ?? 'related-record'}
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
                // here we avoid spreading the 'key' option into the list as it
                // triggers a warning, key isn't supposed to be there according to the
                // type but it is passed in by the Autocomplete component
                renderOption={(props, option) => {
                  const {key, ...optionProps} = props as any;
                  return (
                    <li key={key} {...optionProps}>
                      {option.record_label ?? ''}
                    </li>
                  );
                }}
                options={relatedRecords}
                value={selectedRecord}
                disabled={disabled}
                onChange={(event: any, values: any) => {
                  SetSelectedRecord(values);
                  form.setFieldValue(field.name, values);
                }}
                noOptionsText={`No ${props.related_type_label ?? 'records'} available to link`}
                renderInput={(params: any) => (
                  <TextField
                    {...params}
                    label={props.related_type_label}
                    error={
                      props.form.errors[props.id] === undefined ? false : true
                    }
                    variant="outlined"
                    InputProps={{
                      ...params.InputProps,
                    }}
                  />
                )}
              />
            )}
          </Field>
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
                    serverId={serverId}
                    is_enabled={
                      props.form.isValid === false || props.form.isSubmitting
                        ? false
                        : props.is_enabled
                    }
                    pathname={props.pathname}
                    state={props.state}
                    text={'Add Record'}
                    // This is just form submit - which saves the record
                    handleSubmit={props.handleSubmit}
                    project_id={props.project_id}
                    save_new_record={props.save_new_record}
                    handleError={props.handleCreateError}
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
                Remove existing link to enable Add record or Link
              </Typography>
            </Grid>
          )}
      </Grid>
    </Box>
  );
}
