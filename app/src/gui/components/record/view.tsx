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

import {ProjectUIModel} from '@faims3/data-model';
import NoteIcon from '@mui/icons-material/Note';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import {
  Alert,
  Box,
  Collapse,
  Divider,
  Grid,
  IconButton,
  Link,
  Paper,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import {FormikProps} from 'formik';
import React from 'react';
import RecordDraftState from '../../../sync/draft-state';
import {theme} from '../../themes';
import {AnnotationField} from './Annotation';
import {EditConflictDialog} from './conflict/conflictDialog';
import {getComponentFromFieldConfig} from './fields';

type ViewProps = {
  viewName: string;
  ui_specification: ProjectUIModel;
  formProps: FormikProps<{[key: string]: unknown}>;
  draftState?: RecordDraftState | null;
  annotation: any;
  handleAnnotation: any;
  isSyncing?: string;
  conflictfields?: string[] | null; // those two props are handling the conflict icons
  handleChangeTab: any;
  fieldNames: string[]; //add for branching logic
  disabled?: boolean; // add for view tab or edit tab
  hideErrors?: boolean;
  formErrors?: {[fieldName: string]: unknown};
  visitedSteps: Set<string>;
  currentStepId: string;
  isRevisiting: boolean;
  handleSectionClick: (section: string) => void;
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
  const {visitedSteps, viewName, formProps, ui_specification, isRevisiting} =
    props;
  const fieldNames: string[] = props.fieldNames;
  const fields = ui_specification.fields;

  // check if this stepper has errors
  const hasErrors = fieldNames.some(field => !!formProps.errors[field]);

  // show errors only if the step was revisited and has errors
  const shouldShowErrors = isRevisiting && hasErrors;

  // other sections that has been visited and has errors.
  const otherSectionsWithErrors = Array.from(visitedSteps)
    .filter(section => section !== viewName)
    .filter(section =>
      // Ccheck if any field in the form errors belongs to this section
      Object.keys(formProps.errors).some(field =>
        ui_specification.views[section]?.fields.includes(field)
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

      {/*  all errors (current section + other sections) inside the same bbox */}
      {(shouldShowErrors || otherSectionsWithErrors.length > 0) && (
        <Alert severity="error" sx={{mt: 2, p: 2, borderRadius: '8px'}}>
          {shouldShowErrors && (
            <Typography
              variant="h5"
              sx={{
                display: 'flex',
                alignItems: 'center',
                fontWeight: 'bold',
                fontSize: {xs: '0.9rem', sm: '1.1rem'},
              }}
            >
              Form has errors. Click to fix:
            </Typography>
          )}

          {shouldShowErrors &&
            displayErrors(
              formProps.errors,
              viewName,
              ui_specification,
              fieldNames
            )}

          {shouldShowErrors && (
            <Divider
              sx={{
                my: 2,
                backgroundColor: theme.palette.error.main,
                height: '0.02em',
              }}
            />
          )}

          {/* Display other sections with errors */}
          {otherSectionsWithErrors.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                mt: 1,
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 'bold',
                  alignItems: 'center',
                  fontSize: {xs: '0.9rem', sm: '1.1rem'},
                }}
              >
                Other sections have errors. Click to navigate:
              </Typography>

              {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                otherSectionsWithErrors.map((section, _index) => (
                  <Link
                    key={section}
                    component="button"
                    variant="body2"
                    onClick={() => props.handleSectionClick(section)}
                    sx={{
                      display: 'inline-flex',
                      color: theme.palette.highlightColor.main,
                      fontSize: {xs: '0.85rem', sm: '1rem'},
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      '&:hover': {
                        color: theme.palette.secondary.main,
                        transform: 'scale(1.02)',
                      },
                      mt: 1,
                    }}
                  >
                    {ui_specification.views[section]?.label || section}
                  </Link>
                ))
              }
            </Box>
          )}
        </Alert>
      )}
    </React.Fragment>
  );
}

/**
 * @function displayErrors
 * @description
 *   Displays validation errors for the form fields within a given view.
 *   Enables smooth scrolling to fields with errors and highlights them temporarily.
 *
 * @param {object} errors - The form errors object from Formik.
 * @param {string} thisView - The current view name.
 * @param {ProjectUIModel} ui_specification - The UI model containing field definitions.
 * @param {string[]} currentFields - The fields belonging to the current view.
 * @param {string[]} [otherSections] - (Optional) Other sections with errors. *
 * @returns {JSX.Element} - A list of error messages with interactive navigation.
 */
function displayErrors(
  errors: any | undefined,
  thisView: string,
  ui_specification: ProjectUIModel,
  currentFields: string[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _otherSections?: string[]
) {
  if (!errors) return <p>No errors to display</p>;

  function scrollToField(field: string) {
    const element = document.querySelector(`[data-field="${field}"]`);
    if (element) {
      element.scrollIntoView({behavior: 'smooth', block: 'center'});

      (element as HTMLElement).style.transition =
        'background-color 1s ease-in-out, box-shadow 1s ease-in-out, opacity 1s ease-in-out';
      (element as HTMLElement).style.backgroundColor = '#FCCCCCD7';
      (element as HTMLElement).style.boxShadow =
        '0px 0px 15px rgba(255, 0, 0, 0.3)';

      setTimeout(() => {
        (element as HTMLElement).style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        (element as HTMLElement).style.boxShadow =
          '0px 0px 10px rgba(255, 0, 0, 0.3)';
      }, 1000);

      setTimeout(() => {
        (element as HTMLElement).style.backgroundColor =
          'rgba(255, 0, 0, 0.05)';
        (element as HTMLElement).style.boxShadow =
          '0px 0px 5px rgba(255, 0, 0, 0.2)';
      }, 1500);

      setTimeout(() => {
        (element as HTMLElement).style.backgroundColor = 'transparent';
        (element as HTMLElement).style.boxShadow = 'none';
        (element as HTMLElement).style.opacity = '1';
      }, 2000);
    }
  }

  const filteredErrors = Object.keys(errors).filter(field =>
    currentFields.includes(field)
  );

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
          style={{
            marginBottom: '6px',
            display: isMobile ? 'inline-flex' : 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            width: '100%',
            lineHeight: '40px',
          }}
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
              fontSize: {xs: '0.85rem', sm: '1rem'},
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
            sx={{
              color: theme.palette.icon?.required,
              marginLeft: '20px',
              fontSize: {xs: '0.75rem', sm: '0.9rem'},
            }}
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
        <ReportProblemIcon
          fontSize="small"
          sx={{
            color: theme.palette.highlightColor.main,
            marginRight: '5px',
          }}
        />
        <Typography
          sx={{
            fontSize: {xs: '0.85rem', sm: '1rem'},
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: {xs: '80vw', sm: 'none'},
          }}
        >
          {fieldName}
        </Typography>
      </span>
    );
  } else {
    return field;
  }
}
