// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Alert, Box, Button, Grid, Tab, Tabs, Snackbar} from '@mui/material';
import DebouncedTextField from './debounced-text-field';
import AddIcon from '@mui/icons-material/Add';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

import {TabContext} from '@mui/lab';
import {useState, useEffect, useCallback} from 'react';
// eslint-disable-next-line n/no-extraneous-import
import {ActionCreators} from 'redux-undo';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {FormEditor} from './form-editor';
import {shallowEqual} from 'react-redux';
import {Link, Route, Routes, useLocation, useNavigate} from 'react-router-dom';

export const DesignPanel = () => {
  const navigate = useNavigate();
  const {pathname} = useLocation();

  const basePath = pathname.split('/').slice(0, 2).join('/');

  const viewSets = useAppSelector(
    state => state.notebook['ui-specification'].present.viewsets,
    shallowEqual
  );
  const visibleTypes: string[] = useAppSelector(
    state => state.notebook['ui-specification'].present.visible_types
  );
  const dispatch = useAppDispatch();

  const startTabIndex = pathname.split('/')[2];
  const [tabIndex, setTabIndex] = useState(startTabIndex);
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [untickedForms, setUntickedForms] = useState<string[]>(
    Object.keys(viewSets).filter(form => !visibleTypes.includes(form))
  );

  const [newFormName, setNewFormName] = useState(
    () => `Form ${Object.keys(viewSets).length + 1}`
  );

  useEffect(() => {
    setNewFormName(`Form ${Object.keys(viewSets).length + 1}`);
  }, [viewSets]);

  const maxKeys = Object.keys(viewSets).length;

  // State for toast notifications
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Use redux-undo state to determine if there is something to undo/redo
  const undoableState = useAppSelector(
    state => state.notebook['ui-specification']
  );
  const canUndo = undoableState.past.length > 0;
  const canRedo = undoableState.future.length > 0;

  const handleToastClose = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setToastOpen(false);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setIndexAndNavigate(newValue.toString());
  };

  const handleCheckboxTabChange = (viewSetID: string, ticked: boolean) => {
    if (!ticked) {
      // add form to the array of unticked forms (the form has already been removed from visible_types at this point)
      setUntickedForms([...untickedForms, viewSetID]);
      // ensure the tab index jumps to the end of all the tabs
      setIndexAndNavigate(`${maxKeys - 1}`);
    } else {
      // filter the form out of the array of unticked forms (the form has already been re-added to visible_types at this point)
      setUntickedForms(
        untickedForms.filter(untickedForm => untickedForm !== viewSetID)
      );
      // ensure the tab index jumps somewhat intuitively
      setIndexAndNavigate(`${visibleTypes.length}`);
    }
  };

  const handleDeleteFormTabChange = (viewSetID: string) => {
    if (untickedForms.includes(viewSetID)) {
      // if the form we want to delete is unticked, remove it from the local state
      // this is a special case as the array that holds these forms in the frontend
      // has nothing to do with the state in the redux store
      setUntickedForms(
        untickedForms.filter(untickedForm => untickedForm !== viewSetID)
      );

      if (
        untickedForms.indexOf(viewSetID) === untickedForms.length - 1 &&
        untickedForms.length > 1
      ) {
        // ensure an intuitive tab index jump when an unticked form at the end of the array gets deleted
        // that is, jump to the second to last unticked form
        // not to the "+" tab
        // this is scenario 2, see PR
        setIndexAndNavigate(
          `${visibleTypes.length + untickedForms.length - 2}`
        );
      }
    }

    if (visibleTypes.includes(viewSetID)) {
      // handle intuitive tab index jumps

      // scenario 1
      if (
        visibleTypes.indexOf(viewSetID) === visibleTypes.length - 1 &&
        visibleTypes.length > 1
      ) {
        setIndexAndNavigate(`${visibleTypes.length - 2}`);
      }

      // scenario 3
      if (visibleTypes.length === 1) {
        setIndexAndNavigate(`${maxKeys - 1}`);
      }
    }
  };

  const addNewForm = () => {
    setAlertMessage('');
    try {
      dispatch({
        type: 'ui-specification/viewSetAdded',
        payload: {formName: newFormName},
      });
      setIndexAndNavigate(`${visibleTypes.length}`);
      setAlertMessage('');
    } catch (error: unknown) {
      error instanceof Error && setAlertMessage(error.message);
    }
  };

  const moveForm = (viewSetID: string, moveDirection: 'left' | 'right') => {
    if (moveDirection === 'left') {
      dispatch({
        type: 'ui-specification/viewSetMoved',
        payload: {viewSetId: viewSetID, direction: 'left'},
      });
      setIndexAndNavigate(`${parseInt(tabIndex) - 1}`);
    } else {
      dispatch({
        type: 'ui-specification/viewSetMoved',
        payload: {viewSetId: viewSetID, direction: 'right'},
      });
      setIndexAndNavigate(`${parseInt(tabIndex) + 1}`);
    }
  };

  const setIndexAndNavigate = (index: string) => {
    setTabIndex(index);
    navigate(`${basePath}/${index}`);
  };

  const handleSectionMove = (targetViewSetId: string) => {
    // get the combined array of forms in order
    const combinedArray = [...visibleTypes, ...untickedForms];
    const targetIndex = combinedArray.indexOf(targetViewSetId);

    if (targetIndex >= 0) {
      // find the target section's index in the target form
      const targetForm = viewSets[targetViewSetId];
      const targetSectionIndex = targetForm.views.length; // new section is added at the end

      // update the form index and navigate
      setTabIndex(targetIndex.toString());
      navigate(`${basePath}/${targetIndex}?section=${targetSectionIndex}`);
    }
  };

  const handleFieldMove = (targetViewId: string) => {
    // find which form contains the target section
    for (const [formId, form] of Object.entries(viewSets)) {
      if (form.views.includes(targetViewId)) {
        // get the combined array of forms in order
        const combinedArray = [...visibleTypes, ...untickedForms];
        const targetIndex = combinedArray.indexOf(formId);

        if (targetIndex >= 0) {
          // find the target section's index in the target form
          const targetSectionIndex = form.views.indexOf(targetViewId);
          // Update the form index and navigate
          setTabIndex(targetIndex.toString());
          navigate(`${basePath}/${targetIndex}?section=${targetSectionIndex}`);
        }
        break;
      }
    }
  };

  function handleUndo(): void {
    if (!canUndo) {
      setToastMessage('Nothing to undo');
      setToastOpen(true);
      return;
    }
    dispatch(ActionCreators.undo());
    setToastMessage('Undo complete');
    setToastOpen(true);
  }

  function handleRedo(): void {
    if (!canRedo) {
      setToastMessage('Nothing to redo');
      setToastOpen(true);
      return;
    }
    dispatch(ActionCreators.redo());
    setToastMessage('Redo complete');
    setToastOpen(true);
  }

  // Keyboard shortcuts for undo/redo
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault();
        handleUndo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === 'y' ||
          (event.shiftKey && event.key.toLowerCase() === 'z'))
      ) {
        event.preventDefault();
        handleRedo();
      }
    },
    [canUndo, canRedo]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <>
      <Box sx={{display: 'flex', justifyContent: 'flex-end', marginBottom: 2}}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<UndoIcon />}
          onClick={handleUndo}
          disabled={!canUndo}
          sx={{marginRight: 2}}
        >
          Undo
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<RedoIcon />}
          onClick={handleRedo}
          disabled={!canRedo}
        >
          Redo
        </Button>
      </Box>
      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={handleToastClose}
        message={toastMessage}
      />
      <TabContext value={tabIndex}>
        <Alert severity="info" sx={{marginBottom: 2}}>
          Define the user interface for your notebook here. Add one or more
          forms to collect data from users. Each form can have one or more
          sections. Each section has one or more form fields.
        </Alert>

        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            aria-label="form tabs"
            variant="scrollable"
            scrollButtons={false}
            indicatorColor={
              tabIndex >= `${visibleTypes.length}` && tabIndex < `${maxKeys}`
                ? 'secondary'
                : 'primary'
            }
          >
            {visibleTypes.map((form: string, index: number) => (
              <Tab
                component={Link}
                to={`${basePath}/${index}`}
                key={index}
                value={`${index}`}
                label={`Form: ${viewSets[form].label}`}
                sx={{
                  '&.MuiTab-root': {
                    backgroundColor: '#F9FAFB',
                    border: '0.75px solid #669911',
                    borderBottom: 'none',
                    borderTopLeftRadius: '10px',
                    borderTopRightRadius: '10px',
                    marginRight: '0.5em',
                  },
                  '&.Mui-selected': {
                    border: '1px solid #669911',
                    backgroundColor: '#F5FCE8',
                  },
                  '&:hover': {
                    color: '#669911',
                    opacity: 1,
                    backgroundColor: '#F5FCE8',
                  },
                }}
              />
            ))}
            {untickedForms.map((form: string, index: number) => {
              const startIndex: number = index + visibleTypes.length;
              return (
                <Tab
                  component={Link}
                  to={`${basePath}/${startIndex}`}
                  key={startIndex}
                  value={`${startIndex}`}
                  label={`Form: ${viewSets[form].label}`}
                  sx={{
                    '&.MuiTab-root': {
                      backgroundColor: '#F9FAFB',
                      border: '0.75px solid #E18200',
                      borderBottom: 'none',
                      borderTopLeftRadius: '10px',
                      borderTopRightRadius: '10px',
                      marginX: '0.25em',
                    },
                    '&.Mui-selected': {
                      color: '#E18200',
                      border: '1px solid #E18200',
                      backgroundColor: '#FFF4E5',
                    },
                    '&:hover': {
                      color: '#E18200',
                      opacity: 1,
                      backgroundColor: '#FFF4E5',
                    },
                  }}
                />
              );
            })}
            <Tab
              component={Link}
              to={`${basePath}/${maxKeys}`}
              key={maxKeys}
              value={maxKeys.toString()}
              icon={<AddIcon />}
              sx={{
                '&.MuiTab-root': {
                  backgroundColor: '#F9FAFB',
                  border: '0.75px solid #669911',
                  borderBottom: 'none',
                  borderTopLeftRadius: '10px',
                  borderTopRightRadius: '10px',
                  marginLeft: '0.5em',
                },
                '&.Mui-selected': {
                  color: '#669911',
                  border: '1px solid #669911',
                  backgroundColor: '#F5FCE8',
                },
                '&:hover': {
                  color: '#669911',
                  opacity: 1,
                  backgroundColor: '#F5FCE8',
                },
              }}
            />
          </Tabs>
        </Box>

        <Routes>
          {visibleTypes.map((form: string, index: number) => (
            <Route
              key={index}
              path={`${index}`}
              element={
                <FormEditor
                  viewSetId={form}
                  moveCallback={moveForm}
                  moveButtonsDisabled={false}
                  handleChangeCallback={handleCheckboxTabChange}
                  handleDeleteCallback={handleDeleteFormTabChange}
                  handleSectionMoveCallback={handleSectionMove}
                  handleFieldMoveCallback={handleFieldMove}
                />
              }
            />
          ))}

          {untickedForms.map((form: string, index: number) => {
            const startIndex: number = index + visibleTypes.length;
            return (
              <Route
                key={startIndex}
                path={`${startIndex}`}
                element={
                  <FormEditor
                    viewSetId={form}
                    moveCallback={moveForm}
                    moveButtonsDisabled={true}
                    handleChangeCallback={handleCheckboxTabChange}
                    handleDeleteCallback={handleDeleteFormTabChange}
                    handleSectionMoveCallback={handleSectionMove}
                    handleFieldMoveCallback={handleFieldMove}
                  />
                }
              />
            );
          })}

          <Route
            path={maxKeys.toString()}
            element={
              <Grid container spacing={2} pt={3}>
                <Grid item xs={12} sm={6}>
                  <form
                    onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                      e.preventDefault();
                      addNewForm();
                    }}
                  >
                    <DebouncedTextField
                      fullWidth
                      required
                      label="Form Name"
                      helperText="Enter a name for the form."
                      name="formName"
                      data-testid="formName"
                      value={newFormName}
                      onChange={(
                        event: React.ChangeEvent<HTMLInputElement>
                      ) => {
                        setNewFormName(event.target.value);
                      }}
                    />
                  </form>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={addNewForm}
                  >
                    Add New Form
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  {alertMessage && (
                    <Alert severity="error">{alertMessage}</Alert>
                  )}
                </Grid>
              </Grid>
            }
          />
        </Routes>
      </TabContext>
    </>
  );
};
