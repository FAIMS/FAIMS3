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

/**
 * @file Form tabs, add form, undo/redo, and routed `FormEditor` instances.
 */

import {
  Alert,
  Box,
  Button,
  Grid,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import DebouncedTextField from './debounced-text-field';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';

import {TabContext} from '@mui/lab';
import {useState, useEffect} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {FormEditor} from './form-editor';
import {shallowEqual} from 'react-redux';
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import {viewSetAdded, viewSetMoved} from '../store/slices/uiSpec';
import type {PreviewOutletContext} from './notebook-editor';

/** Main designer surface: form tabs, undo/redo, snackbars, and `FormEditor` routes. */
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

  const {previewForm, setPreviewForm} =
    useOutletContext<PreviewOutletContext>();

  const [newFormName, setNewFormName] = useState(
    () => `Form ${Object.keys(viewSets).length + 1}`
  );

  useEffect(() => {
    setNewFormName(`Form ${Object.keys(viewSets).length + 1}`);
  }, [viewSets]);

  const maxKeys = Object.keys(viewSets).length;

  const headingRowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  } as const;

  const headingTextSx = {
    color: 'text.primary',
    fontWeight: 700,
  } as const;

  const infoIconSx = {
    color: '#1E88E5',
  } as const;

  const subtitleSx = {
    color: 'text.secondary',
    fontWeight: theme => theme.typography.fontWeightMedium,
    lineHeight: 1.5,
    maxWidth: 'none',
    whiteSpace: 'nowrap',
  } as const;

  const visibleTabSx = {
    '&.MuiTab-root': {
      backgroundColor: '#FFFFFF',
      borderStyle: 'solid',
      borderWidth: '2px',
      borderColor: '#E18200',
      borderBottom: 'none',
      borderTopLeftRadius: '10px',
      borderTopRightRadius: '10px',
      marginRight: '0.5em',
      minHeight: 48,
      minWidth: 160,
      maxWidth: 260,
      paddingX: 2,
      paddingY: 1,
      textTransform: 'uppercase',
      fontWeight: 700,
      fontSize: '0.75rem',
      lineHeight: 1.2,
      whiteSpace: 'normal',
      textAlign: 'center',
      color: 'text.secondary',
    },
    '&.Mui-selected': {
      borderColor: '#6B9B1A',
      color: '#6B9B1A',
      backgroundColor: '#F5FCE8',
    },
    '&:hover': {
      color: '#6B9B1A',
      opacity: 1,
      backgroundColor: '#F5FCE8',
    },
  } as const;

  const untickedTabSx = {
    '&.MuiTab-root': {
      backgroundColor: '#FFFFFF',
      borderStyle: 'solid',
      borderWidth: '2px',
      borderColor: '#E18200',
      borderBottom: 'none',
      borderTopLeftRadius: '10px',
      borderTopRightRadius: '10px',
      marginRight: '0.5em',
      minHeight: 48,
      minWidth: 160,
      maxWidth: 260,
      paddingX: 2,
      paddingY: 1,
      textTransform: 'uppercase',
      fontWeight: 700,
      fontSize: '0.75rem',
      lineHeight: 1.2,
      whiteSpace: 'normal',
      textAlign: 'center',
      color: 'text.secondary',
    },
    '&.Mui-selected': {
      color: '#E18200',
      borderColor: '#E18200',
      backgroundColor: '#FFF4E5',
    },
    '&:hover': {
      color: '#E18200',
      opacity: 1,
      backgroundColor: '#FFF4E5',
    },
  } as const;

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
      dispatch(viewSetAdded({formName: newFormName}));
      setIndexAndNavigate(`${visibleTypes.length}`);
      setAlertMessage('');
    } catch (error: unknown) {
      error instanceof Error && setAlertMessage(error.message);
    }
  };

  const moveForm = (viewSetID: string, moveDirection: 'left' | 'right') => {
    if (moveDirection === 'left') {
      dispatch(viewSetMoved({viewSetId: viewSetID, direction: 'left'}));
      setIndexAndNavigate(`${parseInt(tabIndex) - 1}`);
    } else {
      dispatch(viewSetMoved({viewSetId: viewSetID, direction: 'right'}));
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

  return (
    <>
      <TabContext value={tabIndex}>
        <Box sx={{mb: 1.5, mt: 0.5}}>
          <Box sx={headingRowSx}>
            <Typography variant="h5" sx={headingTextSx}>
              Forms
            </Typography>
            <Tooltip title="Add info text here.">
              <InfoIcon sx={infoIconSx} fontSize="small" />
            </Tooltip>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mt: 0.75,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="body1" sx={subtitleSx}>
              Define the user interface for your notebook here. Add one or more
              forms to collect data from users. Each form can have one or more
              sections. Each section has one or more form fields.
            </Typography>
          </Box>
        </Box>

        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            aria-label="form tabs"
            variant="scrollable"
            scrollButtons={false}
            TabIndicatorProps={{sx: {display: 'none'}}}
            sx={{minHeight: 48}}
          >
            {visibleTypes.map((form: string, index: number) => (
              <Tab
                component={Link}
                to={`${basePath}/${index}`}
                key={index}
                value={`${index}`}
                label={`Form: ${viewSets[form].label}`.toUpperCase()}
                wrapped
                sx={visibleTabSx}
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
                  label={`Form: ${viewSets[form].label}`.toUpperCase()}
                  wrapped
                  sx={untickedTabSx}
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
                ...visibleTabSx,
                '&.MuiTab-root': {
                  ...visibleTabSx['&.MuiTab-root'],
                  minWidth: 56,
                  maxWidth: 56,
                  marginLeft: '0.5em',
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
                  handleAddFormCallback={addNewForm}
                  previewForm={previewForm}
                  setPreviewForm={setPreviewForm}
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
                  handleAddFormCallback={addNewForm}
                  previewForm={previewForm}
                  setPreviewForm={setPreviewForm}
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
