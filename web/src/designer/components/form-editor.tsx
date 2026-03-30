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
 * @file One notebook form: sections, live preview, delete guards, visibility in tab bar.
 */

import {getMapConfig} from '@/constants';
import {UISpecification} from '@faims3/data-model';
import {PreviewFormManager} from '@faims3/forms';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import InfoIcon from '@mui/icons-material/Info';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  createTheme,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  Step,
  StepButton,
  Stepper,
  useMediaQuery,
  useTheme,
  ThemeProvider,
  Tooltip,
  Typography,
} from '@mui/material';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import {useQueryClient} from '@tanstack/react-query';
import {cloneDeep} from 'lodash';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {shallowEqual} from 'react-redux';
import {useLocation} from 'react-router-dom';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {findFormExternalUsage} from './condition/utils';
import DebouncedTextField from './debounced-text-field';
import {DeletionWarningDialog} from './deletion-warning-dialog';
import {FormSettingsContent} from './form-settings';
import {SectionEditor} from './section-editor';
import {
  formVisibilityUpdated,
  sectionAdded,
  sectionDeleted,
  sectionMoved,
  sectionMovedToForm,
  viewSetDeleted,
  viewSetRenamed,
} from '../store/slices/uiSpec';

// Default MUI theme for the live form preview (no custom palette).
const defaultTheme = createTheme();

/** Props for one form tab: reorder/delete, visibility toggle, section list, live preview. */
type Props = {
  viewSetId: string;
  moveCallback: (viewSetID: string, moveDirection: 'left' | 'right') => void;
  moveButtonsDisabled: boolean;
  handleChangeCallback: (viewSetID: string, ticked: boolean) => void;
  handleDeleteCallback: (viewSetID: string) => void;
  handleSectionMoveCallback: (targetViewSetId: string) => void;
  handleFieldMoveCallback: (targetViewId: string) => void;
  handleAddFormCallback: () => void;
  previewForm: boolean;
  setPreviewForm: (preview: boolean) => void;
};

/** Single form (`viewSet`): sections stepper, CRUD, optional `PreviewFormManager`, settings panel. */
export const FormEditor = ({
  viewSetId,
  moveCallback,
  moveButtonsDisabled,
  handleChangeCallback,
  handleDeleteCallback,
  handleSectionMoveCallback,
  handleFieldMoveCallback,
  handleAddFormCallback,
  previewForm,
  setPreviewForm,
}: Props) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const sectionParam = searchParams.get('section');

  const uiSpec = useAppSelector(
    state => state.notebook['ui-specification'].present
  );
  // we need this to be a ProjectUIModel type for the PreviewFormManager
  // we should also compile this
  const uiSpecInternal = useMemo(
    () => {
      if (!previewForm) return null;
      // Clone the uiSpec - we need to do this to make it mutable
      const uiSpecEncoded = cloneDeep(uiSpec);
      return {
        fields: uiSpecEncoded.fields,
        views: uiSpecEncoded.fviews,
        viewsets: uiSpecEncoded.viewsets,
        visible_types: uiSpecEncoded.visible_types,
      } satisfies UISpecification;
    },
    // Bit of a hack to force diff on uiSpec even tho ref may no
    [previewForm, uiSpec]
  );

  const visibleTypes = useAppSelector(
    state => state.notebook['ui-specification'].present.visible_types
  );
  const viewsets = useAppSelector(
    state => state.notebook['ui-specification'].present.viewsets
  );
  const viewSet = useAppSelector(
    state => state.notebook['ui-specification'].present.viewsets[viewSetId],
    (left, right) => {
      return shallowEqual(left, right);
    }
  );
  const sections = viewSet ? viewSet.views : [];

  const views = useAppSelector(
    state => state.notebook['ui-specification'].present.fviews
  );
  const fields = useAppSelector(
    state => state.notebook['ui-specification'].present.fields
  );
  const dispatch = useAppDispatch();

  const [activeStep, setActiveStep] = useState(0);
  const [newSectionName, setNewSectionName] = useState('New Section');
  const [alertMessage, setAlertMessage] = useState('');
  const [addAlertMessage, setAddAlertMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [deleteAlertMessage, setDeleteAlertMessage] = useState('');
  const [deleteAlertTitle, setDeleteAlertTitle] = useState('');
  const [preventDeleteDialog, setPreventDeleteDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [checked, setChecked] = useState(true);
  const [initialIndex, setInitialIndex] = useState(
    visibleTypes.indexOf(viewSetId)
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useTheme();
  const settingsFullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [showConditionAlert, setShowConditionAlert] = useState(false);
  const [conditionReferences, setConditionReferences] = useState<string[]>([]);

  // Refs for the scroll container and section steps.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [showRightGradient, setShowRightGradient] = useState(false);

  // needed for the form preview
  const queryClient = useQueryClient();

  // Update overflow gradient overlay on scroll, hidng it when scrolled to the end.
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const {scrollLeft, scrollWidth, clientWidth} = container;
      setShowRightGradient(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  const handleStep = (step: number) => () => {
    setActiveStep(step);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleChange = (ticked: boolean) => {
    // there must be >1 forms in the notebook, and, therefore, >1 visible forms, in order to be able to untick the checkbox
    if (
      (Object.keys(viewsets).length > 1 && visibleTypes.length > 1) ||
      ticked
    ) {
      setAlertMessage('');
      dispatch(formVisibilityUpdated({viewSetId, ticked, initialIndex}));
      handleChangeCallback(viewSetId, ticked);
    }
    // in the case that there are multiple forms in the notebook, but none are visible, allow to re-tick the checkbox
    else if (visibleTypes.length === 0) {
      setAlertMessage('');
      setChecked(ticked);
      setInitialIndex(0);
      dispatch(
        formVisibilityUpdated({
          viewSetId,
          ticked: checked,
          initialIndex: initialIndex,
        })
      );
      handleChangeCallback(viewSetId, checked);
    } else {
      setAlertMessage('This must remain ticked in at least one (1) form.');
    }
  };

  const deleteSection = (viewSetID: string, viewID: string) => {
    dispatch(sectionDeleted({viewSetID, viewID}));
    // making sure the stepper jumps steps (forward or backward) intuitively
    if (
      viewSet.views[viewSet.views.length - 1] === viewID &&
      viewSet.views.length > 1
    ) {
      setActiveStep(activeStep - 1);
    }
  };

  const moveSectionToForm = (
    sourceViewSetId: string,
    targetViewSetId: string,
    viewId: string
  ) => {
    try {
      dispatch(sectionMovedToForm({sourceViewSetId, targetViewSetId, viewId}));

      setAddAlertMessage('');
      // let sectionEditor component know a section was moved successfully
      handleSectionMoveCallback(targetViewSetId);
      return true;
    } catch (error: unknown) {
      error instanceof Error && setAddAlertMessage(error.message);
    }
    return false;
  };

  const moveSection = (
    viewSetID: string,
    viewID: string,
    moveDirection: 'left' | 'right'
  ) => {
    if (moveDirection === 'left') {
      dispatch(
        sectionMoved({viewSetId: viewSetID, viewId: viewID, direction: 'left'})
      );
      // making sure the stepper jumps a step backward intuitively
      setActiveStep(activeStep - 1);
    } else {
      dispatch(
        sectionMoved({viewSetId: viewSetID, viewId: viewID, direction: 'right'})
      );
      // making sure the stepper jumps a step forward intuitively
      setActiveStep(activeStep + 1);
    }
  };

  const addNewSection = (viewSetID: string, label: string) => {
    try {
      dispatch(sectionAdded({viewSetId: viewSetID, sectionLabel: label}));
      // jump to the newly created section (i.e., to the end of the stepper)
      setActiveStep(viewSet.views.length);
      setAddAlertMessage('');
      // let sectionEditor component know a section was addedd successfully
      return true;
    } catch (error: unknown) {
      error instanceof Error && setAddAlertMessage(error.message);
    }
    return false;
  };

  const updateFormLabel = (label: string) => {
    dispatch(viewSetRenamed({viewSetId, label}));
  };

  const deleteConfirmation = () => {
    const conditionRefs = findFormExternalUsage(
      viewSetId,
      viewsets,
      views,
      fields
    );

    const relatedRefs: string[] = [];
    const fieldValues = Object.values(fields);

    fieldValues.forEach(fieldValue => {
      if (fieldValue['component-parameters'].related_type === viewSetId) {
        const relatedFieldName = fieldValue['component-parameters'].name;
        const sectionRef = findRelatedFieldLocation(relatedFieldName);
        relatedRefs.push(
          `Field '${relatedFieldName}' is linked in ${sectionRef}`
        );
      }
    });

    const allReferences = [...conditionRefs, ...relatedRefs];

    if (allReferences.length > 0) {
      setConditionReferences(allReferences);
      setShowConditionAlert(true);
    } else {
      setOpen(true);
      setPreventDeleteDialog(false);
      setDeleteAlertTitle('Are you sure you want to delete this form?');
      setDeleteAlertMessage('All fields in the form will also be deleted.');
    }
  };

  const findRelatedFieldLocation = (fieldName: string | undefined): string => {
    if (!fieldName) return '';

    // Iterate over all sections
    for (const [sectionId, section] of Object.entries(views)) {
      if (section.fields.includes(fieldName)) {
        // Find which form contains this section
        for (const [, form] of Object.entries(viewsets)) {
          if (form.views.includes(sectionId)) {
            return `Form '${form.label}', Section '${section.label}'`;
          }
        }
      }
    }

    return 'Unknown location'; // Fallback if something went wrong
  };

  const preventFormDelete = () => {
    // we don't need the field keys, only their values
    const fieldValues = Object.values(fields);
    let flag = false;
    // search through all the values for mention of the form to be deleted in the related_type param
    fieldValues.forEach(fieldValue => {
      if (fieldValue['component-parameters'].related_type === viewSetId) {
        flag = true;
        // extracting the name of the field to advise the user
        const relatedFieldName = fieldValue['component-parameters'].name;
        // finding the exact location of the field in the notebook to advise the user
        findRelatedFieldLocation(relatedFieldName);
      }
    });
    return flag;
  };

  const deleteForm = () => {
    // SANITY CHECK. Don't allow the user to delete the form if they've used it in a RelatedRecordSelector field
    if (preventFormDelete()) {
      setOpen(true);
      setPreventDeleteDialog(true);
    } else {
      handleDeleteCallback(viewSetId);
      dispatch(viewSetDeleted({viewSetId: viewSetId}));
      handleClose();
    }
  };

  const moveForm = (viewSetID: string, moveDirection: 'left' | 'right') => {
    moveCallback(viewSetID, moveDirection);
  };

  const moveFieldToSection = (targetViewId: string) => {
    handleFieldMoveCallback(targetViewId);
  };

  // Scroll the active step into view.
  const scrollActiveStepIntoView = useCallback(() => {
    const container = scrollContainerRef.current;
    const selected = stepRefs.current[activeStep];
    if (container && selected) {
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      if (
        selectedRect.left < containerRect.left ||
        selectedRect.right > containerRect.right
      ) {
        selected.scrollIntoView({behavior: 'smooth', inline: 'center'});
      }
    }
  }, [activeStep]);

  useEffect(() => {
    scrollActiveStepIntoView();
  }, [activeStep, scrollActiveStepIntoView]);

  useEffect(() => {
    handleScroll();
  }, [sections.length]);

  useEffect(() => {
    window.addEventListener('resize', scrollActiveStepIntoView);
    return () => window.removeEventListener('resize', scrollActiveStepIntoView);
  }, [scrollActiveStepIntoView]);

  useEffect(() => {
    // Set active step from URL parameter if available
    if (sectionParam !== null) {
      const sectionIndex = parseInt(sectionParam);
      if (
        !isNaN(sectionIndex) &&
        sectionIndex >= 0 &&
        sectionIndex < sections.length
      ) {
        setActiveStep(sectionIndex);
      }
    }
  }, [sectionParam, sections.length]);

  return (
    <Stack direction="row" spacing={2}>
      <Grid container spacing={2} pt={3}>
        <Grid item xs={12}>
          <Stack spacing={1.5} py={1.5}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              rowGap={0.5}
              columnGap={1}
              sx={{color: 'text.secondary'}}
            >
              <Typography
                variant="subtitle1"
                sx={{
                  color: 'text.primary',
                  fontWeight: 700,
                  letterSpacing: '0.01em',
                }}
              >
                Form controls
              </Typography>

              <Button
                variant="contained"
                size="small"
                startIcon={<AddRoundedIcon />}
                onClick={handleAddFormCallback}
                sx={{textTransform: 'none', fontWeight: 700, boxShadow: 'none'}}
              >
                New Form
              </Button>

              <Typography sx={{color: 'text.disabled'}}> | </Typography>

              <Button
                variant="text"
                size="small"
                color="inherit"
                startIcon={<EditRoundedIcon />}
                onClick={() => setEditMode(true)}
                sx={{
                  color: 'text.secondary',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  letterSpacing: '0.03em',
                }}
              >
                Edit name
              </Button>

              <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />

              <Stack direction="row" spacing={1} alignItems="center">
                {moveButtonsDisabled ? (
                  <Tooltip title='Only forms with an "Add New Record" button can be re-ordered.'>
                    <span>
                      <IconButton
                        disabled
                        aria-label="left"
                        size="small"
                        sx={{color: 'text.secondary', p: 0.5}}
                      >
                        <ArrowBackRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        disabled
                        aria-label="right"
                        size="small"
                        sx={{color: 'text.secondary', p: 0.5}}
                      >
                        <ArrowForwardRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : (
                  <>
                    <Tooltip title="Move form left">
                      <span>
                        <IconButton
                          disabled={visibleTypes.indexOf(viewSetId) === 0}
                          onClick={() => moveForm(viewSetId, 'left')}
                          aria-label="left"
                          size="small"
                          sx={{color: 'text.secondary', p: 0.5}}
                        >
                          <ArrowBackRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move form right">
                      <span>
                        <IconButton
                          disabled={
                            visibleTypes.indexOf(viewSetId) ===
                            visibleTypes.length - 1
                          }
                          onClick={() => moveForm(viewSetId, 'right')}
                          aria-label="right"
                          size="small"
                          sx={{color: 'text.secondary', p: 0.5}}
                        >
                          <ArrowForwardRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </>
                )}
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  Reorder
                </Typography>
              </Stack>

              <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />

              <Button
                variant="text"
                size="small"
                color="inherit"
                startIcon={<SettingsRoundedIcon />}
                onClick={() => setSettingsOpen(true)}
                sx={{
                  color: 'text.secondary',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  letterSpacing: '0.03em',
                }}
              >
                Settings
              </Button>

              <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />

              <Button
                variant="text"
                color="error"
                size="small"
                startIcon={<DeleteRoundedIcon />}
                onClick={deleteConfirmation}
                sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  letterSpacing: '0.03em',
                }}
              >
                Delete
              </Button>

              <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />

              <FormControlLabel
                sx={{
                  ml: 'auto',
                  '& .MuiFormControlLabel-label': {
                    color: 'text.secondary',
                    fontWeight: 600,
                  },
                }}
                control={
                  <Checkbox
                    checked={visibleTypes.includes(viewSetId)}
                    size="small"
                    onChange={e => handleChange(e.target.checked)}
                  />
                }
                label={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2">
                      Include "Add New Record" button
                    </Typography>
                    <Tooltip title="Add info text here.">
                      <InfoOutlinedIcon color="info" fontSize="small" />
                    </Tooltip>
                  </Stack>
                }
              />

            </Stack>

            {editMode && (
              <form
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  setEditMode(false);
                }}
              >
                <DebouncedTextField
                  size="small"
                  margin="dense"
                  label="Form Name"
                  name="label"
                  data-testid="label"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Done">
                          <IconButton size="small" type="submit">
                            <DoneRoundedIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Close">
                          <IconButton
                            size="small"
                            onClick={() => setEditMode(false)}
                          >
                            <CloseRoundedIcon />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                  value={viewSet.label}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    updateFormLabel(event.target.value);
                  }}
                  sx={{'& .MuiInputBase-root': {paddingRight: 0}}}
                />
              </form>
            )}

            {alertMessage && <Alert severity="error">{alertMessage}</Alert>}
          </Stack>
          <Divider sx={{borderColor: 'divider', borderWidth: 2}} />

          <Dialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            maxWidth="sm"
            fullWidth
            fullScreen={settingsFullScreen}
            PaperProps={{
              sx: {
                borderRadius: {xs: 0, sm: 2},
                width: '100%',
                m: {xs: 0, sm: 2},
              },
            }}
          >
            <DialogTitle>Form Settings</DialogTitle>
            <DialogContent
              dividers
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <FormSettingsContent viewSetId={viewSetId} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSettingsOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={open}
            onClose={handleClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-dialog-title">{deleteAlertTitle}</DialogTitle>
            <DialogContent>
              <DialogContentText id="alert-dialog-description">
                {deleteAlertMessage}
              </DialogContentText>
            </DialogContent>
            {preventDeleteDialog ? (
              <DialogActions>
                <Button onClick={handleClose}>OK</Button>
              </DialogActions>
            ) : (
              <DialogActions>
                <Button onClick={deleteForm}>Yes</Button>
                <Button onClick={handleClose}>No</Button>
              </DialogActions>
            )}
          </Dialog>
          <DeletionWarningDialog
            open={showConditionAlert}
            title="Form cannot be deleted due to active references"
            references={conditionReferences}
            onClose={() => setShowConditionAlert(false)}
          />

          <Stack direction="row" alignItems="center" spacing={1} mt={2} mb={1}>
            <Typography
              variant="h5"
              sx={{
                color: 'text.primary',
                fontWeight: theme => theme.typography.fontWeightBold,
              }}
            >
              Sections
            </Typography>
            <Tooltip title="Add info text here.">
              <InfoOutlinedIcon color="info" fontSize="small" />
            </Tooltip>
          </Stack>
        </Grid>
        <Grid item xs={12}>
          <Card variant="outlined" sx={{borderColor: 'divider', borderWidth: 2}}>
            <Grid container spacing={2} p={3}>
              <Grid item xs={12}>
                <Box sx={{position: 'relative'}}>
                  {/* outer scroll container */}
                  <Box
                    ref={scrollContainerRef}
                    sx={{
                      overflowX: sections.length > 2 ? 'auto' : 'hidden',
                      display: 'flex',
                      justifyContent: 'center',
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(107, 114, 128, 0.9) transparent',
                      '&::-webkit-scrollbar': {
                        height: 6,
                      },
                      '&::-webkit-scrollbar-track': {
                        backgroundColor: 'transparent',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(107, 114, 128, 0.8)',
                        borderRadius: 999,
                      },
                    }}
                    onScroll={handleScroll}
                  >
                    {/*
                      inner scroll container:
                      - min width of 70% of  available space.
                      - uses flex layout.
                      - if only a few steps, they expand to fill the space.
                      - once  there are many steps each step shrinks only to its minimum width (120px)
                        and the container’s total width exceeds the viewport so scrolling is enabled.
                    */}
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'nowrap',
                        minWidth: '70%',
                        width: '100%',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Stepper
                        nonLinear
                        activeStep={activeStep}
                        alternativeLabel
                        sx={{my: 3, width: '100%'}}
                      >
                        {sections.map((section: string, index: number) => (
                          <Step
                            key={section}
                            // each step is flexible and has a minimum width.
                            sx={{flex: '1 1 0', minWidth: '120px'}}
                          >
                            <StepButton
                              color="inherit"
                              onClick={handleStep(index)}
                            >
                              <Typography>{views[section].label}</Typography>
                            </StepButton>
                          </Step>
                        ))}
                      </Stepper>
                    </Box>
                  </Box>
                  {showRightGradient && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: 40,
                        height: '100%',
                        pointerEvents: 'none',
                        background: theme =>
                          `linear-gradient(to left, ${theme.palette.background.paper}, transparent)`,
                      }}
                    />
                  )}
                </Box>
              </Grid>

              {sections.length === 0 ? (
                <Grid item xs={12}>
                  <Grid
                    container
                    justifyContent="center"
                    alignItems="center"
                    item
                    xs={12}
                    direction="column"
                  >
                    <Alert severity="success">
                      Form has been created. Add a section to get started.
                    </Alert>
                    <form
                      onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        addNewSection(viewSetId, newSectionName);
                      }}
                    >
                      <DebouncedTextField
                        required
                        label="Section Name"
                        name="sectionName"
                        data-testid="sectionName"
                        value={newSectionName}
                        onChange={(
                          event: React.ChangeEvent<HTMLInputElement>
                        ) => {
                          setNewSectionName(event.target.value);
                        }}
                        sx={{'& .MuiInputBase-root': {paddingRight: 1}, mt: 3}}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Tooltip title="Add">
                                <IconButton type="submit">
                                  <AddRoundedIcon />
                                </IconButton>
                              </Tooltip>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </form>
                  </Grid>
                  {addAlertMessage && (
                    <Alert severity="error">{addAlertMessage}</Alert>
                  )}
                </Grid>
              ) : (
                <Grid item xs={12}>
                  <SectionEditor
                    viewSetId={viewSetId}
                    viewId={viewSet.views[activeStep] || viewSet.views[0]}
                    viewSet={viewSet}
                    deleteCallback={deleteSection}
                    moveSectionCallback={moveSectionToForm}
                    addCallback={addNewSection}
                    moveCallback={moveSection}
                    handleSectionMoveCallback={handleSectionMoveCallback}
                    moveFieldCallback={moveFieldToSection}
                  />
                </Grid>
              )}
            </Grid>
          </Card>
        </Grid>
      </Grid>
      {previewForm && uiSpecInternal && (
        <Grid container item sx={{minWidth: '300px'}} xs={6}>
          <Box sx={{width: '100%'}}>
            <ThemeProvider theme={defaultTheme}>
              {/* resets CSS baseline within this scope */}
              <CssBaseline />
              <PreviewFormManager
                initialFormData={{}}
                layout={uiSpec.viewsets[viewSetId].layout ?? 'tabs'}
                formName={viewSetId}
                uiSpec={uiSpecInternal}
                queryClient={queryClient}
                mapConfig={getMapConfig}
              />
            </ThemeProvider>
          </Box>
        </Grid>
      )}
    </Stack>
  );
};
