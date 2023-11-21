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
import {RecordReference} from 'faims3-datamodel';
import {Field} from 'formik';
import AddIcon from '@mui/icons-material/Add';
import {CreateRecordLinkProps} from '../types';
import {useNavigate} from 'react-router-dom';
import {LocationState} from 'faims3-datamodel';
import * as ROUTES from '../../../../../constants/routes';
import {logError} from '../../../../../logging';

export function AddNewRecordButton(props: {
  is_enabled: boolean;
  pathname: string;
  state: LocationState;
  text: string;
  handleSubmit: Function;
  project_id: string;
  save_new_record: Function;
  handleError: Function;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const history = useNavigate();
  const handleSubmit = () => {
    setSubmitting(true);
    const new_child_id = props.save_new_record();
    if (props.handleSubmit !== undefined) {
      props
        .handleSubmit()
        .then((result: string) => {
          const newState = props.state;
          newState['parent_link'] = ROUTES.getRecordRoute(
            props.project_id,
            (props.state.parent_record_id || '').toString(),
            (result || '').toString()
          ).replace('/notebooks/', '');
          newState['child_record_id'] = new_child_id;
          setTimeout(() => {
            // reset local state of component
            setSubmitting(false);
            history(props.pathname, {state: newState});
          }, 300);
        })
        .catch((error: Error) => {
          logError(error);
          if (props.handleError !== undefined)
            props.handleError(new_child_id, new_child_id);
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
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: `Link between this record ${props.InputLabelProps.label} and ${selectedRecord.record_label} added`,
            severity: 'success',
          },
        });
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
      <Box>
        <Typography variant={'subtitle2'} sx={{mb: 1}}>
          Add a link to an existing record.
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
                    is_enabled={
                      props.form.isValid === false || props.form.isSubmitting
                        ? false
                        : props.is_enabled
                    }
                    pathname={props.pathname}
                    state={props.state}
                    text={'Add Record'}
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
