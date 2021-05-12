import React from 'react';
import {Button, Grid, Box} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import grey from '@material-ui/core/colors/grey';
import CircularProgress from '@material-ui/core/CircularProgress';
import {getComponentByName} from './ComponentRegistry';
import {getUiSpecForProject} from '../uiSpecification';
import {Formik, Form, Field, FormikProps} from 'formik';
import {transformAll} from '@demvsystems/yup-ast';
import {ViewComponent} from './view';
import {upsertFAIMSData} from '../dataStorage';
import {ProjectUIModel, SavedView} from '../datamodel';
import {getStagedData, setStagedData} from '../sync/staging';

type FormProps = {
  activeProjectID: string;
  uiSpec: ProjectUIModel;
  observation: {_id: string; _rev: string} | null;
};

// After this many errors happen with from the staging db
// on consequitive calls, the error is bubbled up to this
// FormState's stagingError.
const MAX_CONSEQUTIVE_STAGING_SAVE_ERRORS = 5;

type FormState = {
  stagingState: ['error', unknown] | 'idle' | 'staging';
  currentView: string | null;
};

export class FAIMSForm extends React.Component<FormProps, FormState> {
  staged: {
    [view: string]: {
      [fieldName: string]: {
        /*
        To keep syncing data to the stagedDB:
        Every time the user changes something, the value here is updated immediately.

        Then staging.setStagedData() is called. The promise is saved to setter
        OR if setter already has a value, the promise is stored to next (overwriting).

        Said promise, before it finishes, moves the next promise to setter and runs it.
        (setting next to null).
        This means that if a field is updated while setter Promise is still putting
        stuff in the DB, everyone waits until it's done with the DB to avoid conflicts.

        The setter promise updates _rev when it can, as a 'cache' to not need to do db.get()s 
        */
        value: string;
        // setter: null | Promise<void>;
        saving: boolean;
        next: null | (() => Promise<void>);
        _rev: null | string;
      };
    };
  } = {};

  consequtiveStagingSaveErrors = 0;

  componentDidUpdate(prevProps: FormProps) {
    if (prevProps.activeProjectID !== this.props.activeProjectID) {
      this.staged = {};
      this.setState({currentView: null});
      this.setUISpec();
    }
  }

  constructor(props: FormProps) {
    super(props);
    this.state = {
      currentView: null,
      stagingState: 'idle',
    };
    this.getComponentFromField = this.getComponentFromField.bind(this);
    this.getValidationSchema = this.getValidationSchema.bind(this);
    this.getInitialValues = this.getInitialValues.bind(this);
    this.setState = this.setState.bind(this);
    this.getFieldNames = this.getFieldNames.bind(this);
    this.getFields = this.getFields.bind(this);
  }

  async componentDidMount() {
    await this.setUISpec();
  }

  async setUISpec() {
    const uiSpec = await getUiSpecForProject(this.props.activeProjectID);
    // All staged data must either be loaded or error out
    // before we allow the user to edit it (Prevents overwriting stuff the user starts writing if they're quick)

    const viewStageLoaders = Object.entries(uiSpec['views']).map(([viewName]) =>
      getStagedData(
        this.props.activeProjectID,
        this.state.currentView!,
        null
      ).then(staged_data_restore => {
        this.staged[viewName] = {};
        for (const fieldName in staged_data_restore) {
          if (fieldName === '_id') continue; // _id gets caught up in this from datamodel.SavedView
          this.staged[viewName][fieldName] = {
            value: staged_data_restore[fieldName],
            saving: false,
            next: null,
            _rev: null,
          };
        }
      })
    );

    await Promise.all(viewStageLoaders);
    this.setState({
      currentView: uiSpec['start_view'],
    });
  }

  reqireCurrentView(): string {
    if (this.state.currentView === null) {
      // What should prevent this from happening is the lack of getInitialValues,
      // getComponentFor, etc, function calls in the _Loading Skeleton_.
      // And the loading skeleton is always shown if currentView === null
      throw Error(
        'A function requiring currentView was called before currentView instantiated'
      );
    }
    return this.state.currentView;
  }

  save(values: any) {
    console.log(values);
    upsertFAIMSData(this.props.activeProjectID, values);
  }

  updateView(viewName: string) {
    if (viewName in this.props.uiSpec['views']) {
      this.setState({currentView: viewName});
      this.forceUpdate();
      // Probably not needed, but we *know* we need to rerender when this
      // changes, so let's be explicit.
    } else {
      throw Error(`No view ${viewName}`);
    }
  }
  interceptChange<E>(
    handleChange: (evt: E) => unknown,
    values: {[key: string]: unknown},
    fieldName: string,
    evt: E & {currentTarget:{value: string}},
    value: string
  ): void {
    handleChange(evt);
    const newValues = {...values} as {[fieldName: string]: string};
    newValues[fieldName] = value || evt.currentTarget.value;

    const stagedArgs: [string, string, null | {_id: string; _rev: string}] = [
      this.props.activeProjectID,
      this.reqireCurrentView(),
      this.props.observation,
    ];

    const stagedView = this.staged[this.reqireCurrentView()];
    // Same as prevState[prevState.currentView]
    // These should remain the same (NOT copied) for the lifetime of a field
    // setState isn't called when these are modified, even though they are a (nested)
    // part of the state, because these aren't shown through to the UI,
    // It might cause performance issues, I'm not sure if this is a good way to do it.
    if (!(fieldName in stagedView)) {
      console.warn(`Late instantiation of staged field ${fieldName}`);
      stagedView[fieldName] = {
        value: value,
        next: null,
        _rev: null,
        saving: false,
      };
    }

    const field = stagedView[fieldName];

    const setterWithRev = async (_rev: null | string) => {
      console.debug('setterWithRev');
      const {rev} = await setStagedData(newValues, _rev, ...stagedArgs);
      field._rev = rev;
    };

    // Called after the staged data is saved to the DB.
    // to call any queued up setters.
    const nextSetter = async () => {
      console.debug('nextSetter');
      const next_setter = field.next;
      field.next = null;
      this.consequtiveStagingSaveErrors = 0;
      getStagedData(...stagedArgs).then(console.info);
      if (next_setter !== null) {
        console.log('Running queued stage save');
        next_setter();
      } else {
        console.log('Finished staging save queue');
        field.saving = false;
        this.setState({stagingState: 'idle'});
      }
    };

    // Gets _rev if not already known,
    // Then will push the new staged data to the DB.
    const setterFunc = async () => {
      field.saving = true;
      if (this.state.stagingState !== 'staging') {
        this.setState({stagingState: 'staging'});
      }
      const setted =
        field._rev === null
          ? getStagedData(...stagedArgs).then(saved =>
              setterWithRev(saved?._rev as null | string)
            )
          : setterWithRev(field._rev!);

      // After set (and possible getting revision)
      // Run the next setterFunc in the queue
      // to put more data into the staging db.\
      setted.then(nextSetter).catch(err => {
        if (
          err.constructor !== Error ||
          err.message !== 'Running 2 staging promises at the same time!'
        ) {
          console.error(err);
          this.consequtiveStagingSaveErrors += 1;
          if (
            this.consequtiveStagingSaveErrors ===
            MAX_CONSEQUTIVE_STAGING_SAVE_ERRORS
          ) {
            this.setState({stagingState: ['error', err]});
          }
        } else {
          console.debug(err);
        }
      });
    };

    field.value = value;
    if (field.saving === false) {
      //field.saving is changed at the same time as state.stagingState
      console.log('Running stage save immediately');
      setterFunc();
    } else {
      console.log('Queueing staging save');
      field.next = setterFunc;
    }
  }

  getComponentFromField(fieldName: string, view: ViewComponent) {
    // console.log('getComponentFromField');
    const uiSpec = this.props.uiSpec;
    const fields = uiSpec['fields'];
    return this.getComponentFromFieldConfig(fields[fieldName], view, fieldName);
  }

  getComponentFromFieldConfig(
    fieldConfig: any,
    view: ViewComponent,
    fieldName: string
  ) {
    // console.log('getComponentFromFieldConfig');
    const namespace = fieldConfig['component-namespace'];
    const name = fieldConfig['component-name'];
    let Component;
    try {
      Component = getComponentByName(namespace, name);
    } catch (err) {
      console.debug(err);
      console.warn(`Failed to load component ${namespace}::${name}`);
      return undefined;
    }
    const formProps: FormikProps<{[key: string]: unknown}> =
      view.props.formProps;
    return (
      <Box mb={3} key={fieldName}>
        <Field
          component={Component} //e.g, TextField (default <input/>)
          name={fieldName}
          onChange={(evt: React.ChangeEvent<{value: string}>, value: string) =>
            this.interceptChange(
              formProps.handleChange,
              formProps.values,
              fieldName,
              evt,
              value
            )
          }
          onBlur={(evt: React.FocusEvent<{value: string}>, value: string) =>
            this.interceptChange(
              formProps.handleBlur,
              formProps.values,
              fieldName,
              evt,
              value
            )
          }
          value={formProps.values[fieldName]}
          // error={
          //   formProps.touched[fieldName] && Boolean(formProps.errors[fieldName])
          // }
          // view={view}
          {...fieldConfig['component-parameters']}
          {...fieldConfig['component-parameters']['InputProps']}
          {...fieldConfig['component-parameters']['SelectProps']}
          {...fieldConfig['component-parameters']['InputLabelProps']}
          {...fieldConfig['component-parameters']['FormHelperTextProps']}
        />
      </Box>
    );
  }

  getFieldNames() {
    const currentView = this.reqireCurrentView();
    const fieldNames: Array<string> = this.props.uiSpec['views'][currentView][
      'fields'
    ];
    return fieldNames;
  }

  getFields() {
    const currentView = this.reqireCurrentView();
    const fields: {[key: string]: {[key: string]: any}} = this.props.uiSpec[
      'fields'
    ];
    return fields;
  }

  getValidationSchema() {
    /***
     * Formik requires a single object for validationSchema, collect these from the ui schema
     * and transform via yup.ast
     */
    const fieldNames = this.getFieldNames();
    const fields = this.getFields();
    const validationSchema = Object();
    fieldNames.forEach(fieldName => {
      validationSchema[fieldName] = fields[fieldName]['validationSchema'];
    });
    return transformAll([['yup.object'], ['yup.shape', validationSchema]]);
  }

  getInitialValues() {
    /***
     * Formik requires a single object for initialValues, collect these from the ui schema
     */
    const currentView = this.reqireCurrentView();
    const fieldNames = this.getFieldNames();
    const fields = this.getFields();
    const initialValues = Object();
    fieldNames.forEach(fieldName => {
      initialValues[fieldName] =
        this.staged[currentView][fieldName]?.value ||
        fields[fieldName]['initialValue'];
    });
    return initialValues;
  }

  render() {
    const uiSpec = this.props.uiSpec;
    const viewName = this.state.currentView;
    if (viewName !== null) {
      const fieldNames: Array<string> = uiSpec['views'][viewName]['fields'];

      return (
        <React.Fragment>
          <Formik
            initialValues={this.getInitialValues()}
            validationSchema={this.getValidationSchema}
            validateOnMount={true}
            onSubmit={(values, {setSubmitting}) => {
              setTimeout(() => {
                setSubmitting(false);
                console.log('SUBMITTING', JSON.stringify(values, null, 2));
              }, 500);
            }}
          >
            {formProps => (
              <Form>
                <Grid container spacing={2}>
                  <Grid item sm={6} xs={12}>
                    <ViewComponent
                      viewList={fieldNames}
                      form={this}
                      formProps={formProps}
                    />
                    <br />
                    {formProps.isValid ? (
                      ''
                    ) : (
                      <Alert severity="error">
                        Form has errors, please scroll up and make changes
                        before re-submitting.
                      </Alert>
                    )}
                    <br />
                    <Button
                      type="submit"
                      color={formProps.isSubmitting ? 'default' : 'primary'}
                      variant="contained"
                      onClick={formProps.submitForm}
                      disableElevation
                      disabled={formProps.isSubmitting}
                    >
                      {formProps.isSubmitting ? 'Submitting...' : 'Submit'}
                      {formProps.isSubmitting && (
                        <CircularProgress
                          size={24}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            marginTop: -12,
                            marginLeft: -12,
                          }}
                        />
                      )}
                    </Button>
                  </Grid>
                  <Grid item sm={6} xs={12}>
                    <Box
                      bgcolor={grey[200]}
                      p={2}
                      style={{overflowX: 'scroll'}}
                    >
                      <pre>{JSON.stringify(formProps, null, 2)}</pre>
                    </Box>
                  </Grid>
                </Grid>
              </Form>
            )}
          </Formik>
        </React.Fragment>
      );
    } else {
      return <div>Loading UI...</div>;
    }
  }
}
