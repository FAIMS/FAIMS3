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
 * @file Form tabs, add/move form controls, and routed `FormEditor` instances.
 */

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  Theme,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import DebouncedTextField from './debounced-text-field';
import AddIcon from '@mui/icons-material/Add';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import InfoIcon from '@mui/icons-material/Info';

import {TabContext} from '@mui/lab';
import {useState, useEffect, useRef} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {FormEditor} from './form-editor';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogContentSx,
  designerDialogTitleSx,
  designerInfoIconSx,
  designerPrimaryActionButtonSx,
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
import {SimpleFieldWrapper} from './Fields/SimpleFieldWrapper';
import {NOTEBOOK_NAME} from '@/constants';

/** Main designer surface for form tabs and routed `FormEditor` instances. */
export const DesignPanel = () => {
  const navigate = useNavigate();
  const {pathname} = useLocation();

  const basePath = pathname.split('/').slice(0, 2).join('/');

  const viewSets = useAppSelector(
    state => state.notebook.uiSpec.present.viewsets,
    shallowEqual
  );
  const visibleTypes: string[] = useAppSelector(
    state => state.notebook.uiSpec.present.visible_types
  );
  const dispatch = useAppDispatch();

  const startTabIndex = pathname.split('/')[2];
  const [tabIndex, setTabIndex] = useState(startTabIndex);
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [untickedForms, setUntickedForms] = useState<string[]>(
    Object.keys(viewSets).filter(form => !visibleTypes.includes(form))
  );

  const {previewForm} = useOutletContext<PreviewOutletContext>();

  const [newFormName, setNewFormName] = useState(
    () => `Form ${Object.keys(viewSets).length + 1}`
  );
  const [addFormDialogOpen, setAddFormDialogOpen] = useState(false);
  const theme = useTheme();
  const addFormDialogFullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const compactAddTab = useMediaQuery(theme.breakpoints.down('md'));
  const formTabsRef = useRef<HTMLDivElement | null>(null);
  const [hasFormTabOverflow, setHasFormTabOverflow] = useState(false);
  const [formToolbarSlot, setFormToolbarSlot] = useState<HTMLDivElement | null>(
    null
  );

  useEffect(() => {
    setNewFormName(`Form ${Object.keys(viewSets).length + 1}`);
  }, [viewSets]);

  useEffect(() => {
    const el = formTabsRef.current;
    if (!el) return;
    const scroller = el.querySelector(
      '.MuiTabs-scroller'
    ) as HTMLElement | null;
    if (!scroller) return;

    const updateOverflow = () => {
      setHasFormTabOverflow(scroller.scrollWidth > scroller.clientWidth + 4);
    };

    updateOverflow();
    scroller.addEventListener('scroll', updateOverflow, {passive: true});
    window.addEventListener('resize', updateOverflow);
    return () => {
      scroller.removeEventListener('scroll', updateOverflow);
      window.removeEventListener('resize', updateOverflow);
    };
  }, [visibleTypes.length, untickedForms.length, compactAddTab]);

  const maxKeys = Object.keys(viewSets).length;

  const baseTabRootSx = {
    '&.MuiTab-root': {
      backgroundColor: 'grey.100',
      borderStyle: 'solid',
      borderWidth: '2px',
      borderColor: 'divider',
      borderBottom: 'none',
      borderTopLeftRadius: '10px',
      borderTopRightRadius: '10px',
      marginRight: '0.5em',
      minHeight: 48,
      minWidth: {xs: 110, sm: 130, md: 150},
      maxWidth: {xs: 200, sm: 220, md: 260},
      paddingX: {xs: 1, sm: 1.5},
      paddingY: 1,
      textTransform: 'uppercase',
      fontWeight: 600,
      fontSize: '0.72rem',
      lineHeight: 1.2,
      whiteSpace: 'normal',
      textAlign: 'center',
      color: 'text.primary',
      flexShrink: 0,
    },
  } as const;

  // Selected tabs: solid primary fill, consistent across visible and unticked tabs.
  const selectedTabSx = {
    borderColor: 'primary.main',
    color: 'primary.contrastText',
    backgroundColor: 'primary.main',
    fontWeight: 800,
    boxShadow: (t: Theme) =>
      `0 3px 10px ${alpha(t.palette.primary.main, 0.34)}`,
  } as const;

  const visibleTabSx = {
    ...baseTabRootSx,
    '&.Mui-selected': selectedTabSx,
    // Light tint on hover — never pitch-black regardless of primary.dark value.
    '&:not(.Mui-selected):hover': {
      color: 'primary.main',
      backgroundColor: (t: Theme) => alpha(t.palette.primary.main, 0.1),
    },
  };

  // Unticked (hidden) forms use the same selected colour as visible forms so
  // the active-indicator colour is always consistent across BSS/fieldmark/default.
  const untickedTabSx = {
    ...baseTabRootSx,
    '&.Mui-selected': selectedTabSx,
    '&:not(.Mui-selected):hover': {
      color: 'primary.main',
      backgroundColor: (t: Theme) => alpha(t.palette.primary.main, 0.08),
    },
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
      const formName = newFormName.trim();
      if (!formName) {
        setAlertMessage('Please enter a form name.');
        return false;
      }
      dispatch(viewSetAdded({formName}));
      // Route directly to the new form and prompt section creation immediately.
      setIndexAndNavigate(`${visibleTypes.length}`, '?createSection=1');
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

  const setIndexAndNavigate = (index: string, search = '') => {
    setTabIndex(index);
    navigate(`${basePath}/${index}${search}`);
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
        <Box
          sx={{
            mb: 1.25,
            mt: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <HeadingWithInfo
            title="Forms"
            tooltip={
              <Box sx={{p: 0.25, maxWidth: 320}}>
                <Typography
                  variant="body2"
                  sx={{fontWeight: 700, mb: 0.5, lineHeight: 1.35}}
                >
                  Forms are top-level data entry pages in your {NOTEBOOK_NAME}.
                </Typography>
                <Typography
                  variant="caption"
                  sx={{display: 'block', lineHeight: 1.45}}
                >
                  Define the user interface for your notebook here. Add one or
                  more forms to collect data from users. Each form can have one
                  or more sections, and each section can have one or more form
                  fields.
                </Typography>
                <Typography
                  variant="caption"
                  sx={{display: 'block', mt: 0.75, lineHeight: 1.45}}
                >
                  Tip: Hold{' '}
                  <Box
                    component="span"
                    sx={{fontFamily: 'monospace', fontWeight: 800}}
                  >
                    Shift
                  </Box>{' '}
                  and scroll your mouse wheel to move sideways through the form
                  and section tabs.
                </Typography>
              </Box>
            }
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={openAddFormDialog}
            sx={{
              ...designerPrimaryActionButtonSx,
              boxShadow: 'none',
              whiteSpace: 'nowrap',
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            New Form
          </Button>
        </Box>

        <Box
          ref={setFormToolbarSlot}
          sx={{
            minHeight: 0,
            '&:not(:empty)': {mb: 0.5},
          }}
        />

        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <Tabs
            ref={formTabsRef}
            value={tabIndex}
            onChange={handleTabChange}
            aria-label="form tabs"
            variant="scrollable"
            scrollButtons={false}
            sx={{
              minHeight: 48,
              ml: 0,
              pl: 0,
              '& .MuiTabs-scroller': {
                overflowX: 'auto !important',
                scrollbarWidth: hasFormTabOverflow ? 'thin' : 'none',
                scrollbarColor: hasFormTabOverflow
                  ? 'rgba(78, 116, 138, 0.42) transparent'
                  : 'transparent transparent',
                '&::-webkit-scrollbar': {
                  height: hasFormTabOverflow ? 8 : 0,
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                  borderRadius: 999,
                },
                '&::-webkit-scrollbar-thumb': {
                  borderRadius: 999,
                  backgroundColor: 'rgba(78, 116, 138, 0.42)',
                },
              },
              '& .MuiTabs-flexContainer': {
                gap: 0,
                alignItems: 'flex-end',
              },
            }}
          >
            {visibleTypes.map((form: string, index: number) => (
              <Tab
                component={Link}
                to={`${basePath}/${index}`}
                key={index}
                value={`${index}`}
                label={viewSets[form].label.toUpperCase()}
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
                  label={viewSets[form].label.toUpperCase()}
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
              label={compactAddTab ? '' : 'NEW FORM'}
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
                  marginLeft: 0,
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
                  previewForm={previewForm}
                  toolbarPortal={formToolbarSlot}
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
                    previewForm={previewForm}
                    toolbarPortal={formToolbarSlot}
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
        slotProps={{
          paper: {
            sx: {
              borderRadius: {xs: 0, sm: 2},
              boxShadow: {xs: 'none', sm: theme.shadows[12]},
              overflow: 'hidden',
              minHeight: {xs: 300, sm: 340},
            },
          },
        }}
      >
        <DialogTitle sx={designerDialogTitleSx}>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75}}>
            <Typography variant="h6" sx={{fontWeight: 800}}>
              Add New Form
            </Typography>
            <Tooltip title="Create a clear form name so editors can find it quickly.">
              <InfoIcon sx={designerInfoIconSx} />
            </Tooltip>
          </Box>
        </DialogTitle>
        <DialogContent sx={{...designerDialogContentSx, pt: 4}}>
          <Box sx={{maxWidth: 740, width: '100%', mx: 'auto'}}>
            <SimpleFieldWrapper
              heading="Form Name"
              helperText={
                alertMessage ||
                'Use a short descriptive name, for example: Household Details.'
              }
            >
              <DebouncedTextField
                fullWidth
                required
                label=""
                placeholder="Enter form name"
                name="formNameDialog"
                data-testid="formNameDialog"
                value={newFormName}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  if (alertMessage) setAlertMessage('');
                  setNewFormName(event.target.value);
                }}
                error={Boolean(alertMessage)}
                sx={{mt: 0.85}}
              />
            </SimpleFieldWrapper>
          </Box>
        </DialogContent>
        <DialogActions sx={designerDialogActionsSx}>
          <Button
            onClick={() => {
              setAddFormDialogOpen(false);
              setAlertMessage('');
            }}
            sx={designerCancelButtonSx}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
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
