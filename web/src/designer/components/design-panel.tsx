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
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  Theme,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import DebouncedTextField from './debounced-text-field';
import AddIcon from '@mui/icons-material/Add';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

import {TabContext} from '@mui/lab';
import {useState, useEffect} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {FormEditor} from './form-editor';
import {
  designerDividerSx,
  designerSubheadingSx,
} from './designer-style';
import {HeadingWithInfo} from './heading-with-info';
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
  const [addFormDialogOpen, setAddFormDialogOpen] = useState(false);
  const theme = useTheme();
  const addFormDialogFullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const compactAddTab = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    setNewFormName(`Form ${Object.keys(viewSets).length + 1}`);
  }, [viewSets]);

  const maxKeys = Object.keys(viewSets).length;
  const hasOverflowingTabs = maxKeys > 6;

  const baseTabRootSx = {
    '&.MuiTab-root': {
      backgroundColor: 'background.paper',
      borderStyle: 'solid',
      borderWidth: '2px',
      borderColor: 'secondary.main',
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
  } as const;

  const visibleTabSx = {
    ...baseTabRootSx,
    '&.Mui-selected': {
      borderColor: 'primary.main',
      color: 'primary.main',
      backgroundColor: (theme: Theme) =>
        alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
    },
    '&:hover': {
      color: 'primary.main',
      opacity: 1,
      backgroundColor: (theme: Theme) =>
        alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
    },
  } as const;

  const untickedTabSx = {
    ...baseTabRootSx,
    '&.Mui-selected': {
      color: 'secondary.main',
      borderColor: 'secondary.main',
      backgroundColor: (theme: Theme) =>
        alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.25 : 0.14),
    },
    '&:hover': {
      color: 'secondary.main',
      opacity: 1,
      backgroundColor: (theme: Theme) =>
        alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
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
      const formName = newFormName.trim();
      if (!formName) {
        setAlertMessage('Please enter a form name.');
        return false;
      }
      dispatch(viewSetAdded({formName}));
      setIndexAndNavigate(`${visibleTypes.length}`);
      setAlertMessage('');
      return true;
    } catch (error: unknown) {
      error instanceof Error && setAlertMessage(error.message);
    }
    return false;
  };

  const openAddFormDialog = () => {
    setAlertMessage('');
    setNewFormName(`Form ${Object.keys(viewSets).length + 1}`);
    setAddFormDialogOpen(true);
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
        <Divider sx={{...designerDividerSx, mb: 1.5}} />
        <Box sx={{mb: 1.25, mt: 0.5}}>
          <HeadingWithInfo
            title="Forms"
            tooltip="Forms are top-level data entry pages in your notebook."
          />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mt: 0.75,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              variant="body1"
              sx={{...designerSubheadingSx, maxWidth: 980}}
            >
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
            visibleScrollbar
            scrollButtons="auto"
            allowScrollButtonsMobile
            TabIndicatorProps={{sx: {display: 'none'}}}
            sx={{
              minHeight: 48,
              '& .MuiTabs-scroller': {
                overflowX: 'auto !important',
                overflowY: 'hidden',
                scrollbarWidth: 'thin',
                scrollbarColor: `${alpha(theme.palette.text.primary, 0.45)} transparent`,
              },
              '& .MuiTabs-scroller::-webkit-scrollbar': {
                height: 8,
              },
              '& .MuiTabs-scroller::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
              },
              '& .MuiTabs-scroller::-webkit-scrollbar-thumb': {
                backgroundColor: alpha(theme.palette.text.primary, 0.35),
                borderRadius: 999,
              },
              '& .MuiTabs-scroller::-webkit-scrollbar-thumb:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.5),
              },
            }}
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
              key={maxKeys}
              value={maxKeys.toString()}
              icon={<AddIcon />}
              iconPosition="start"
              label={compactAddTab ? '' : 'New Form'}
              onClick={e => {
                e.preventDefault();
                openAddFormDialog();
              }}
              sx={{
                ...baseTabRootSx,
                '&.MuiTab-root': {
                  ...baseTabRootSx['&.MuiTab-root'],
                  minWidth: compactAddTab ? 56 : 142,
                  maxWidth: compactAddTab ? 56 : 142,
                  marginLeft: '0.5em',
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  borderColor: 'primary.main',
                  textTransform: 'none',
                  boxShadow: theme.shadows[2],
                },
                '&:hover': {
                  backgroundColor: 'primary.dark',
                  borderColor: 'primary.dark',
                  color: 'primary.contrastText',
                  opacity: 1,
                },
              }}
            />
          </Tabs>
        </Box>
        {hasOverflowingTabs && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 0.4,
              mt: 0.25,
              mb: 0.75,
              color: 'text.secondary',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <KeyboardDoubleArrowRightRoundedIcon fontSize="small" />
            <Typography variant="caption" sx={{fontWeight: 600}}>
              Scroll right for more forms
            </Typography>
          </Box>
        )}

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
                  handleAddFormCallback={openAddFormDialog}
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
                  handleAddFormCallback={openAddFormDialog}
                  previewForm={previewForm}
                  setPreviewForm={setPreviewForm}
                />
              }
            />
            );
          })}

        </Routes>
      </TabContext>
      <Dialog
        open={addFormDialogOpen}
        onClose={() => {
          setAddFormDialogOpen(false);
          setAlertMessage('');
        }}
        fullWidth
        maxWidth="sm"
        fullScreen={addFormDialogFullScreen}
        PaperProps={{
          sx: {
            borderRadius: {xs: 0, sm: 2},
            boxShadow: {xs: 'none', sm: theme.shadows[12]},
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            py: 2,
            px: {xs: 2, sm: 3},
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: theme =>
              alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.08),
          }}
        >
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <AddRoundedIcon color="primary" />
            <Typography variant="h6" sx={{fontWeight: 800}}>
              Add New Form
            </Typography>
          </Box>
          <Typography variant="body2" sx={{mt: 0.5, color: 'text.secondary'}}>
            Create a clear form name so editors can find it quickly.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{pt: 2.5, px: {xs: 2, sm: 3}}}>
          <DebouncedTextField
            fullWidth
            required
            label="Form Name"
            helperText="Use a short descriptive name, for example: Household Details."
            name="formNameDialog"
            data-testid="formNameDialog"
            value={newFormName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setNewFormName(event.target.value);
            }}
            sx={{mt: 1}}
          />
          {alertMessage && (
            <Alert severity="error" sx={{mt: 2}}>
              {alertMessage}
            </Alert>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: {xs: 2, sm: 3},
            pb: {xs: 2, sm: 2.5},
            pt: 1.5,
            gap: 1,
            flexDirection: {xs: 'column-reverse', sm: 'row'},
            alignItems: 'stretch',
          }}
        >
          <Button
            onClick={() => {
              setAddFormDialogOpen(false);
              setAlertMessage('');
            }}
            fullWidth={addFormDialogFullScreen}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            fullWidth={addFormDialogFullScreen}
            disabled={!newFormName.trim()}
            onClick={() => {
              if (addNewForm()) {
                setAddFormDialogOpen(false);
              }
            }}
          >
            Add Form
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
