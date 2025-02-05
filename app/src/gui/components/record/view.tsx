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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; // For collapsible sections

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
  const isTouched = props.formProps.touched[fieldName] && !hasError;

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
        transition: 'background-color 0.4s ease, box-shadow 0.4s ease',
        background: hasError
          ? 'linear-gradient(135deg, rgba(255,99,71,0.4), rgba(255,0,0,0.3))'
          : isTouched
            ? 'rgba(0, 255, 0, 0.1)'
            : 'transparent',
        boxShadow: hasError
          ? '0px 0px 12px rgba(255, 0, 0, 0.6)'
          : isTouched
            ? '0px 0px 8px rgba(0, 255, 0, 0.5)'
            : 'none',
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

export function ViewComponent(props: ViewProps) {
  const ui_specification = props.ui_specification;
  const fieldNames: string[] = props.fieldNames;
  const fields = ui_specification.fields;
  const [error, setError] = useState(true);
  const [showErrors, setShowErrors] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);

  useEffect(() => {
    let iserror = fieldNames.some(field =>
      Boolean(props.formProps.errors[field])
    );
    setError(iserror);
  }, [props.formProps]);

  const currentSectionErrors = Object.keys(props.formProps.errors).filter(
    field => fieldNames.includes(field)
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
      {!props.hideErrors && currentSectionErrors.length > 0 && (
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
          }}
          action={
            <IconButton
              color="inherit"
              size="small"
              onClick={() => setShowErrors(prev => !prev)}
            >
              <ExpandMoreIcon
                sx={{
                  transform: showErrors ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease',
                }}
              />
            </IconButton>
          }
        >
          <Typography variant="h6" sx={{fontWeight: 'bold'}}>
            ⚠️ Form has errors. Click to fix:
          </Typography>

          <Collapse in={showErrors}>
            {displayErrors(
              props.formProps.errors,
              props.viewName,
              ui_specification,
              fieldNames
            )}
          </Collapse>
        </Alert>
      )}

      {/* Warning Section */}
      {!props.hideErrors && !props.formProps.isValid && error === false && (
        <Alert
          severity="warning"
          sx={{
            mt: 2,
            p: 2,
            background: 'linear-gradient(135deg, #FFF8E1, #FFE57F)',
            borderRadius: '8px',
            boxShadow: '0px 4px 12px rgba(255, 165, 0, 0.6)',
            overflowX: 'hidden',
          }}
          action={
            <IconButton
              color="inherit"
              size="small"
              onClick={() => setShowWarnings(prev => !prev)}
            >
              <ExpandMoreIcon
                sx={{
                  transform: showWarnings ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease',
                }}
              />
            </IconButton>
          }
        >
          <Typography variant="h6" sx={{fontWeight: 'bold', color: '#FF6F00'}}>
            Please check other sections before submitting.
          </Typography>

          <Collapse in={showWarnings}>
            {displayErrors(
              props.formProps.errors,
              props.viewName,
              ui_specification,
              fieldNames
            )}
          </Collapse>
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
        'background-color 0.5s ease, box-shadow 0.5s ease';
      (element as HTMLElement).style.backgroundColor = '#FFB3B3';
      (element as HTMLElement).style.boxShadow =
        '0px 0px 15px rgba(255, 0, 0, 0.8)';

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
        paddingLeft: '20px',
        marginTop: '10px',
        overflowX: 'hidden',
        maxWidth: '100%',
        whiteSpace: 'normal',
      }}
    >
      {' '}
      {filteredErrors.map(field => (
        <li key={field} style={{listStyle: 'none'}}>
          <Link
            component="button"
            variant="body2"
            onClick={() => scrollToField(field)}
            sx={{
              color: 'red',
              textDecoration: 'underline',
              fontWeight: 'bold',
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              '&:hover': {
                transform: 'scale(1.02)',
                overflow: 'hidden',
              },
            }}
          >
            🚩 {getUsefulFieldNameFromUiSpec(field, thisView, ui_specification)}
          </Link>
          <p style={{fontSize: '14px', margin: '5px 0', color: 'darkred'}}>
            {errors[field]}
          </p>
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
    // get the view that this field is part of
    let sectionName = '';
    for (const section in ui_specification.views) {
      if (ui_specification.views[section].fields.includes(field)) {
        sectionName =
          section === thisView
            ? 'This section'
            : ui_specification.views[section].label || section;
      }
    }
    return `${sectionName} > ${fieldName}`;
  } else {
    return field;
  }
}
