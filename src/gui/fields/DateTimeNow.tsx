import React, {useEffect} from 'react';
import {Stack, Button, FormHelperText} from '@mui/material';
import {fieldToTextField, TextFieldProps} from 'formik-mui';
import MuiTextField from '@mui/material/TextField';
import getLocalDate from './LocalDate';
import {logError} from '../../logging';

type DateTimeNowProps = {
  is_auto_pick?: boolean;
  disabled?: boolean;
};

export function DateTimeNow(props: TextFieldProps & DateTimeNowProps) {
  /**
   * Store value as ISO, but <input> elements of type datetime-local
   * requires format yyyy-MM-ddTHH:mm:ss. We separate the two by keeping
   * a local state displayValue for rendering, and use the formik value to
   * store the ISO format datetime.
   *
   *
   * value: the formik-controlled value
   * displayValue: the input-expected value of format yyyy-MM-ddTHH:mm:ss
   */
  const {
    form: {setFieldValue, setFieldError},
    field: {name, value},
  } = props;

  const [displayValue, setDisplayValue] = React.useState('');

  const handleValues = (newValue: string) => {
    /**
     * The internal value is ISO, display value is yyyy-MM-ddTHH:mm:ss
     */
    const date = new Date(newValue);
    setFieldValue(name, date.toISOString());
  };

  const onChange = React.useCallback(
    (event: any) => {
      const {value} = event.target;
      handleValues(value);
    },
    [setFieldValue, name]
  );

  const onClick = React.useCallback(() => {
    // Populate the form with time now to within 1s.
    handleValues(getLocalDate(new Date()));
  }, [setFieldValue, name]);
  const {helperText, is_auto_pick, ...others} = props;

  useEffect(() => {
    // if the value is updated, update the rendered value too
    if (value) {
      try {
        setDisplayValue(getLocalDate(new Date(value)));
      } catch (err) {
        setFieldError(name, 'Could not set display Value. Contact support.');
        logError(err);
      }
    }
  }, [value]);
  useEffect(() => {
    // set initial time when user open the notebook
    if (is_auto_pick === true && value === '') {
      try {
        const date = new Date();
        setFieldValue(name, date.toISOString());
      } catch (err) {
        setFieldError(name, 'Could not set display value. Contact support.');
        logError(err);
      }
    }
  }, []);

  return (
    <React.Fragment>
      <Stack direction={{xs: 'column', sm: 'row'}} spacing={{xs: 1, sm: 0}}>
        <MuiTextField
          {...fieldToTextField(others)}
          label={props.label}
          type="datetime-local"
          inputProps={{
            step: 1, // this allows for 1s granularity
          }}
          sx={{
            // minWidth: 250,
            '& .MuiOutlinedInput-root': {borderRadius: '3px 0px 0px 4px'},
          }}
          onChange={onChange}
          InputLabelProps={{
            shrink: true,
          }}
          value={displayValue}
          error={!!props.form.errors[name]}
        />
        {props.disabled !== true && ( //add for view and conflict model
          <Button
            variant="contained"
            disableElevation
            aria-label="capture time now"
            onClick={onClick}
            sx={{
              borderRadius: {xs: '3px', sm: '0px 3px 3px 0px'},
            }}
          >
            Now
          </Button>
        )}
      </Stack>
      <FormHelperText
        children={props.helperText ? helperText : 'Select a date and time'}
      />
      {props.form.errors[name] && (
        <FormHelperText
          error={true}
          children={props.form.errors[name] as string}
        />
      )}
    </React.Fragment>
  );
}

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'DateTimeNow',
//   'type-returned': 'faims-core::String', // matches a type in the Project Model
//   'component-parameters': {
//     fullWidth: true,
//     helperText:
//       'Add a datetime stamp (click now to record the current date+time)',
//     variant: 'outlined',
//     required: false,
//     InputLabelProps: {
//       label: 'DateTimeNow Field',
//     },
//     is_auto_pick: false,
//   },
//   validationSchema: [['yup.string']],
//   initialValue: '',
// };
