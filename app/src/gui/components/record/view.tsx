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
 * Filename: view.tsx
 * Description:
 *   TODO
 *   20220620 BBS Adjusted sm to 11 from 8 to get rid of the awful margin reported in FAIMS3-328
 */

import React, {useEffect, useState} from 'react';
import {FormikProps} from 'formik';
import {ProjectUIModel} from '@faims3/data-model';
import RecordDraftState from '../../../sync/draft-state';
import {getComponentFromFieldConfig} from './fields';
import {AnnotationField} from './Annotation';
import {
  Box,
  Grid,
  Paper,
  Alert,
  IconButton,
  Collapse,
  Link,
  Typography,
} from '@mui/material';
import {EditConflictDialog} from './conflict/conflictDialog';
import NoteIcon from '@mui/icons-material/Note';
import {grey} from '@mui/material/colors';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {theme} from '../../themes';
import FlagIcon from '@mui/icons-material/Flag';

type ViewProps = {
  viewName: string;
  ui_specification: ProjectUIModel;
  formProps: FormikProps<{[key: string]: unknown}>;
  draftState?: RecordDraftState | null;
  annotation: any;
  handleAnnotation: any;
  isSyncing?: string;
  conflictfields?: string[] | null; // those two props are handling the conflict icons
  handleChangeTab?: any;
  fieldNames: string[]; //add for branching logic
  disabled?: boolean; // add for view tab or edit tab
  hideErrors?: boolean;
  formErrors?: {[fieldName: string]: unknown};
  visitedSteps: Set<string>;
  currentStepId: string;
};
type SingleComponentProps = {
  fieldName: string;
  fields: {[key: string]: any};
  index: number;
  formProps: FormikProps<{[key: string]: unknown}>;
  annotation: any;
  handleAnnotation: any;
  draftState?: RecordDraftState | null;
  conflictfields?: string[] | null; // those two props are handling the conflict icons
  handleChangeTab?: any;
  isSyncing?: string;
  disabled?: boolean; // add for view tab or edit tab
};

/**
 * @function SingleComponent
 * @description
 *   Renders an individual form field component dynamically based on the provided configuration.
 *   Handles form validation errors, conflict indicators, annotations, and uncertainty details.
 *   Supports expand/collapse functionality for annotations and displays visual cues for errors.
 *
 * @param {SingleComponentProps} props
 *   - `fieldName`: Name of the form field to render.
 *   - `fields`: Field configuration object from the UI specification.
 *   - `formProps`: Formik form properties for managing state and validation.
 *   - `annotation`: Annotation data associated with the field.
 *   - `handleAnnotation`: Function to handle annotation changes.
 *   - `draftState`: Optional draft state for syncing.
 *   - `conflictfields`: List of fields with data conflicts.
 *   - `handleChangeTab`: Function to switch tabs when resolving conflicts.
 *   - `isSyncing`: Indicates syncing status.
 *   - `disabled`: Determines if the field is read-only.
 *
 * @returns {JSX.Element}
 *   The rendered form field with optional annotation and conflict resolution UI.
 *
 * @features
 *   - Dynamic field rendering based on UI configuration.
 *   - Error highlighting and conflict resolution dialog support.
 *   - Annotation and uncertainty field support with expand/collapse toggle.
 *   - Visual indicators for validation errors using smooth transitions.
 */

function SingleComponent(props: SingleComponentProps) {
  const conflictfields = props.conflictfields;
  const fieldName = props.fieldName;
  const fields = props.fields;
  const fieldConfig = fields[fieldName];
  const label = fieldConfig['component-parameters'].label;
  const [expanded, setExpanded] = React.useState(false);
  const hasError = Boolean(
    props.formProps.errors[fieldName] && props.formProps.touched[fieldName]
  );

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };
  const isHiddenField =
    fieldConfig['component-name'] === 'BasicAutoIncrementer';

  // get annotation config, backward compatible with old
  // format
  const annotationConfig = {
    include: false,
    label: 'Annotation',
  };
  if (fieldConfig.meta?.annotation) {
    // value could be a string (legacy) or an object
    if (typeof fieldConfig.meta.annotation !== 'object') {
      annotationConfig.include = fieldConfig.meta.annotation;
      // also label is probably set like this
      if (fieldConfig.meta.annotation_label)
        annotationConfig.label = fieldConfig.meta.annotation_label;
    } else {
      // we have a new style object spec
      annotationConfig.include = fieldConfig.meta.annotation.include || false;
      annotationConfig.label =
        fieldConfig.meta.annotation.label || 'Annotation';
    }
  }

  // uncertainty is simpler as it's always been an object
  const uncertaintyConfig = fieldConfig.meta?.uncertainty || {
    include: false,
    label: 'Uncertainty',
  };

  // should we show annotation/uncertainty at all
  // don't show for a few field types but otherwise do if it is configured
  const show_annotation =
    props.annotation !== undefined &&
    fields[fieldName].meta !== undefined &&
    fields[fieldName]['component-name'] !== 'BasicAutoIncrementer' &&
    fields[fieldName]['component-name'] !== 'TemplatedStringField' &&
    fields[fieldName]['component-name'] !== 'RandomStyle' &&
    fields[fieldName]['component-name'] !== 'RichText' &&
    (annotationConfig.include || uncertaintyConfig.include);
  return (
    <Box
      key={fieldName + props.index}
      mt={isHiddenField ? 0 : 2}
      mb={isHiddenField ? 0 : 2}
      data-field={fieldName}
      sx={{
        borderRadius: '8px',
        transition:
          'background-color 0.4s ease-in-out, box-shadow 0.4s ease-in-out',
        background: hasError
          ? 'rgba(206, 0, 0, 0.01)'
          : 'rgba(200, 200, 200, 0.1)',
        boxShadow: hasError
          ? '0px 0px 5px rgba(250, 0, 0, 0.3)'
          : '0px 0px 5px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Grid container spacing={isHiddenField ? 0 : 1}>
        <Grid item xs={12} sm>
          {getComponentFromFieldConfig(
            fields[fieldName],
            fieldName,
            props.formProps,
            props.isSyncing,
            props.disabled
          )}
          {show_annotation && (
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box
                variant={'outlined'}
                component={Paper}
                elevation={0}
                sx={{ml: {xs: 0, sm: 2}, p: 2, my: 1}}
                bgcolor={grey[100]}
              >
                <AnnotationField
                  key={'annotation-' + props.fieldName + '-box'}
                  fieldName={fieldName}
                  field={fields[fieldName]}
                  annotation={props.annotation}
                  handleAnnotation={props.handleAnnotation}
                  showAnnotation={annotationConfig.include}
                  annotationLabel={annotationConfig.label}
                  showUncertainty={uncertaintyConfig.include}
                  uncertaintyLabel={uncertaintyConfig.label}
                  disabled={props.disabled}
                />
              </Box>
            </Collapse>
          )}
        </Grid>

        {conflictfields !== null &&
          conflictfields !== undefined &&
          conflictfields.includes(fieldName) && (
            <Grid item xs={6} sm={'auto'}>
              <EditConflictDialog
                label={label}
                handleChangeTab={props.handleChangeTab}
              />
            </Grid>
          )}

        {show_annotation && (
          <React.Fragment>
            <Grid item xs={6} sm={'auto'}>
              <IconButton
                color={'info'}
                size={'large'}
                onClick={handleExpandClick}
              >
                <NoteIcon />
              </IconButton>
            </Grid>
          </React.Fragment>
        )}
      </Grid>
    </Box>
  );
}

/**
 * @function ViewComponent
 * @description
 *   Renders a collection of form fields as specified by the UI model. It handles validation
 *   errors, warnings, and integrates field-level annotations and conflict resolutions.
 *   Displays dynamic alerts for form errors and warnings, with interactive error navigation.
 *
 * @param {ViewProps} props
 *   - `viewName`: The name of the current view being rendered.
 *   - `ui_specification`: The UI model defining field configurations.
 *   - `formProps`: Formik properties for managing form state and validation.
 *   - `draftState`: Optional draft state to handle syncing operations.
 *   - `annotation`: Annotation data for fields.
 *   - `handleAnnotation`: Handler function for updating annotations.
 *   - `isSyncing`: Indicates syncing status of the form data.
 *   - `conflictfields`: List of fields with conflicts needing resolution.
 *   - `handleChangeTab`: Function to switch between form tabs.
 *   - `fieldNames`: Array of field names to be rendered in this view.
 *   - `disabled`: Disables form fields if set to true (read-only mode).
 *   - `hideErrors`: Determines if error messages should be hidden.
 *   - `formErrors`: Optional map of field errors for custom error handling.
 *
 * @returns {JSX.Element}
 *   A rendered form view with all configured fields, including error/warning messages
 *   and interactive conflict resolution components.
 *
 * @features
 *   - Dynamic rendering of form fields based on the UI specification.
 *   - Integrated form validation with real-time error/warning indicators.
 *   - Conflict detection and resolution interface.
 *   - Smooth scrolling to error fields for better UX.
 */

export function ViewComponent(props: ViewProps) {
  const ui_specification = props.ui_specification;
  const fieldNames: string[] = props.fieldNames;
  const fields = ui_specification.fields;

  // Track which steppers have been interacted with
  const [interactedSteppers, setInteractedSteppers] = useState<Set<string>>(
    new Set<string>()
  );

  // Get the stepper ID
  const stepperId = props.viewName;

  // Check if any field in this stepper has been interacted with (typed, selected, clicked)
  const isCurrentStepperInteracted = fieldNames.some(
    field =>
      !!props.formProps.touched[field] || // Field was touched
      !!props.formProps.values[field] // Field has a value
  );

  // Track if this stepper has only one field (like a radio group)
  // const isSingleFieldStep = fieldNames.length === 1;

  // Check if this stepper has errors
  const hasErrors = fieldNames.some(field => !!props.formProps.errors[field]);

  // Ensure errors appear if:
  // 1. User interacted with the stepper
  // 2. User has visited this stepper before

  // useEffect(() => {
  //   if (isCurrentStepperInteracted) {
  //     setInteractedSteppers(prev => new Set(prev).add(stepperId));
  //   }
  // }, [isCurrentStepperInteracted, hasErrors]);

  // Track if this stepper has been visited before
  useEffect(() => {
    if (isCurrentStepperInteracted) {
      setInteractedSteppers(prev => new Set(prev).add(stepperId));
    }
  }, [isCurrentStepperInteracted]);

  // Ensure clicks in this stepper mark it as interacted
  const handleStepperInteraction = () => {
    setInteractedSteppers(prev => new Set(prev).add(stepperId));
  };

  // Depend on stepperId to correctly track changes
  // Ensure errors appear only after a stepper was visited & interacted with
  // useEffect(() => {
  //   if (
  //     hasErrors &&
  //     props.visitedSteps.has(stepperId) &&
  //     isCurrentStepperInteracted
  //   ) {
  //     setInteractedSteppers(prev => new Set(prev).add(stepperId));
  //   }
  // }, [hasErrors, props.visitedSteps, isCurrentStepperInteracted]);

  // Should show errors only if:
  // - Stepper has been visited before
  // - Stepper has errors
  // - If it's a single-field stepper, user must have **visited at least once**
  const shouldShowErrors =
    interactedSteppers.has(stepperId) &&
    hasErrors && // Stepper has been interacted with before
    (isCurrentStepperInteracted || interactedSteppers.has(stepperId)); // User has interacted OR revisited the stepper

  // Identify other sections with errors that have been interacted with
  const otherSectionsWithErrors = Array.from(interactedSteppers)
    .filter(section => section !== stepperId)
    .filter(section =>
      Object.keys(props.formProps.errors).some(field =>
        props.ui_specification.views[section]?.fields.includes(field)
      )
    );
  return (
    <React.Fragment>
      {fieldNames?.map((fieldName, index) => (
        <SingleComponent
          fieldName={fieldName}
          fields={fields}
          formProps={props.formProps}
          draftState={props.draftState}
          annotation={props.annotation}
          handleAnnotation={props.handleAnnotation}
          index={index}
          key={index}
          isSyncing={props.isSyncing}
          conflictfields={props.conflictfields}
          handleChangeTab={props.handleChangeTab}
          disabled={props.disabled}
        />
      ))}

      {/* Only show errors if this stepper has been interacted with */}
      {shouldShowErrors && (
        <Alert
          severity="error"
          sx={{
            mt: 2,
            p: 2,
            borderRadius: '8px',
            boxShadow: '0px 4px 12px rgba(255, 0, 0, 0.5)',
            maxWidth: '100%',
            overflowX: 'hidden',
            wordWrap: 'break-word',
            marginBottom: 2,
          }}
        >
          <Typography variant="h6" sx={{fontWeight: 'bold'}}>
            Form has errors. Click to fix:
          </Typography>

          {displayErrors(
            props.formProps.errors,
            props.viewName,
            ui_specification,
            fieldNames
          )}

          {/* Show other stepper names with errors if they have been interacted with */}
          {otherSectionsWithErrors.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle1" sx={{fontWeight: 'bold'}}>
                Other sections with errors:
              </Typography>
              {otherSectionsWithErrors.map(section => (
                <Link
                  key={section}
                  component="button"
                  variant="body2"
                  onClick={() => props.handleChangeTab(section)}
                  sx={{
                    display: 'block',
                    color: theme.palette.primary.main,
                    textDecoration: 'underline',
                    '&:hover': {color: theme.palette.secondary.main},
                    mt: 1,
                  }}
                >
                  {ui_specification.views[section]?.label || section}
                </Link>
              ))}
            </Box>
          )}
        </Alert>
      )}
    </React.Fragment>
  );
}

function displayErrors(
  errors: any | undefined,
  thisView: string,
  ui_specification: ProjectUIModel,
  currentFields: string[]
) {
  if (!errors) return <p>No errors to display</p>;

  function scrollToField(field: string) {
    const element = document.querySelector(`[data-field="${field}"]`);
    if (element) {
      element.scrollIntoView({behavior: 'smooth', block: 'center'});
      (element as HTMLElement).style.transition =
        'background-color 0.5s ease-in-out, box-shadow 0.6s ease-in-out';
      (element as HTMLElement).style.backgroundColor = '#FCCCCCD7';
      (element as HTMLElement).style.boxShadow =
        '0px 0px 15px rgba(255, 0, 0, 0.4)';

      // fade in-out before clearing
      setTimeout(() => {
        (element as HTMLElement).style.backgroundColor =
          'rgba(255, 0, 0, 0.05)';
        (element as HTMLElement).style.boxShadow =
          '0px 0px 10px rgba(255, 0, 0, 0.4)';
      }, 800);

      setTimeout(() => {
        (element as HTMLElement).style.backgroundColor = 'inherit';
        (element as HTMLElement).style.boxShadow = 'none';
      }, 2000);
    }
  }

  const filteredErrors = Object.keys(errors).filter(field =>
    currentFields.includes(field)
  );

  return (
    <ul
      style={{
        paddingLeft: '15px',
        marginTop: '10px',
        overflowX: 'hidden',
        maxWidth: '100%',
        whiteSpace: 'normal',
        listStyleType: 'none',
      }}
    >
      {' '}
      {filteredErrors.map(field => (
        <li
          key={field}
          style={{marginBottom: '6px', display: 'flex', alignItems: 'center'}}
        >
          <Link
            component="button"
            variant="body2"
            onClick={() => scrollToField(field)}
            sx={{
              color: theme.palette.highlightColor.main,
              textDecoration: 'underline',
              fontWeight: 'bold',
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              '&:hover': {
                transform: 'scale(1.02)',
                color: theme.palette.secondary.main,
                textDecoration: 'underline',
                overflow: 'hidden',
              },
            }}
          >
            {getUsefulFieldNameFromUiSpec(field, thisView, ui_specification)}
          </Link>
          <Typography
            variant="body2"
            sx={{color: theme.palette.icon?.required, marginLeft: '20px'}}
          >
            {errors[field]}
          </Typography>
        </li>
      ))}
    </ul>
  );
}

/**
 * Generate a useful field name, <section>:<field> so that a user can see where an error is
 * @param field a form field name
 * @param thisView current view name
 * @param ui_specification the ui specification object
 */
export function getUsefulFieldNameFromUiSpec(
  field: string,
  thisView: string,
  ui_specification: ProjectUIModel
) {
  if (field in ui_specification.fields) {
    const fieldInfo = ui_specification.fields[field];
    const fieldName =
      fieldInfo.label || fieldInfo['component-parameters'].label || field;

    return (
      <span style={{display: 'flex', alignItems: 'center'}}>
        <FlagIcon
          fontSize="small"
          sx={{
            color: theme.palette.highlightColor.contrastText,
            marginRight: '5px',
          }}
        />
        {fieldName}
      </span>
    );
  } else {
    return field;
  }
}
