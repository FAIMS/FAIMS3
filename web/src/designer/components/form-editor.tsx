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
  CircularProgress,
  createTheme,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  useMediaQuery,
  useTheme,
  ThemeProvider,
  Tooltip,
  Typography,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import {createPortal} from 'react-dom';
import CssBaseline from '@mui/material/CssBaseline';
import {useQueryClient} from '@tanstack/react-query';
import {cloneDeep} from 'lodash';
import {useEffect, useMemo, useRef, useState} from 'react';
import {shallowEqual} from 'react-redux';
import {useLocation, useNavigate} from 'react-router-dom';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {findFormExternalUsage} from './condition/utils';
import DebouncedTextField from './debounced-text-field';
import {DeletionWarningDialog} from './deletion-warning-dialog';
import {FormSettingsContent} from './form-settings';
import {SectionEditor} from './section-editor';
import {SimpleFieldWrapper} from './Fields/SimpleFieldWrapper';
import {
  designerCancelButtonSx,
  designerControlLabelSx,
  designerDialogActionsSx,
  designerDialogBodyTextSx,
  designerDialogContentSx,
  designerDialogTitleSx,
  designerInlineEditActionIconSx,
  designerInlineEditFocusOverlaySx,
  designerInlineEditPanelSx,
  designerInfoCalloutSx,
  designerInfoIconSx,
  designerIconControlButtonSx,
  designerPipeSx,
  designerPrimaryActionButtonSx,
  designerResponsiveSectionSx,
  designerScrollableControlRowSx,
} from './designer-style';
import {HeadingWithInfo} from './heading-with-info';
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
  previewForm: boolean;
  /** DOM node to portal the form action row into (lives above the form tabs). */
  toolbarPortal?: HTMLElement | null;
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
  previewForm,
  toolbarPortal,
}: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const sectionParam = searchParams.get('section');
  const createSectionParam = searchParams.get('createSection');

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
  const sectionStripRef = useRef<HTMLDivElement | null>(null);
  const [hasSectionOverflow, setHasSectionOverflow] = useState(false);
  const [sectionToolbarSlot, setSectionToolbarSlot] =
    useState<HTMLDivElement | null>(null);
  const [isSectionAtStart, setIsSectionAtStart] = useState(true);
  const [isSectionAtEnd, setIsSectionAtEnd] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false);
  const prevViewSetIdRef = useRef<string>(viewSetId);
  const formEditInputRef = useRef<HTMLInputElement | null>(null);

  // needed for the form preview
  const queryClient = useQueryClient();

  useEffect(() => {
    const el = sectionStripRef.current;
    if (!el) return;

    const updateScrollState = () => {
      const hasOverflow = el.scrollWidth > el.clientWidth + 2;
      setHasSectionOverflow(hasOverflow);
      setIsSectionAtStart(el.scrollLeft <= 2);
      setIsSectionAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    };

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, {passive: true});
    window.addEventListener('resize', updateScrollState);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [sections.length]);

  const handleStep = (step: number) => () => {
    setActiveStep(step);
  };

  useEffect(() => {
    setAlertMessage('');
  }, [viewSetId]);

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
      // Jump to and focus the newly created section (added to the end).
      const newSectionIndex = viewSet.views.length;
      setActiveStep(newSectionIndex);
      const nextParams = new URLSearchParams(location.search);
      nextParams.set('section', String(newSectionIndex));
      nextParams.delete('createSection');
      navigate(
        `${location.pathname}?${nextParams.toString()}`,
        {
          replace: true,
        }
      );
      window.requestAnimationFrame(() => {
        sectionStripRef.current?.scrollTo({
          left: sectionStripRef.current.scrollWidth,
          behavior: 'smooth',
        });
      });
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

  useEffect(() => {
    if (sections.length === 0 && createSectionParam === '1') {
      setAddSectionDialogOpen(true);
    }
  }, [createSectionParam, sections.length]);

  const clearCreateSectionFlag = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('createSection');
    const nextQuery = nextParams.toString();
    navigate(
      `${location.pathname}${nextQuery.length > 0 ? `?${nextQuery}` : ''}`,
      {
        replace: true,
      }
    );
  };

  const submitNewSection = () => {
    const ok = addNewSection(viewSetId, newSectionName.trim());
    if (ok) {
      setAddSectionDialogOpen(false);
      clearCreateSectionFlag();
    }
  };

  // Show a brief loading spinner in the preview when the user switches form tabs
  useEffect(() => {
    if (prevViewSetIdRef.current === viewSetId) return;
    prevViewSetIdRef.current = viewSetId;
    if (!previewForm) return;
    setPreviewLoading(true);
    const tid = window.setTimeout(() => setPreviewLoading(false), 650);
    return () => window.clearTimeout(tid);
  }, [viewSetId, previewForm]);

  useEffect(() => {
    if (!editMode) return;
    const raf = window.requestAnimationFrame(() => {
      formEditInputRef.current?.focus();
      formEditInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [editMode]);

  const renderFormToolbar = (toolbarStack: React.ReactNode) =>
    toolbarPortal ? createPortal(toolbarStack, toolbarPortal) : toolbarStack;

  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="stretch"
      sx={[designerResponsiveSectionSx, {width: '100%', minWidth: 0, flexWrap: 'nowrap'}]}
    >
      <Grid
        container
        rowSpacing={1.25}
        columnSpacing={0}
        pt={1.25}
        sx={{flex: '1 1 0%', minWidth: 0}}
      >
        <Grid item xs={12}>
          {renderFormToolbar(
          <Stack spacing={1.5} py={0.75}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              columnGap={1}
              sx={{...designerScrollableControlRowSx, color: 'text.secondary'}}
            >
              <Button
                variant="text"
                size="small"
                color="inherit"
                startIcon={<EditRoundedIcon />}
                onClick={() => setEditMode(true)}
                sx={designerControlLabelSx}
              >
                Edit name
              </Button>

              <Typography sx={designerPipeSx}> | </Typography>

              <Stack direction="row" spacing={1} alignItems="center">
                {moveButtonsDisabled ? (
                  <Tooltip title='Only forms with an "Add New Record" button can be re-ordered.'>
                    <span>
                      <IconButton
                        disabled
                        aria-label="left"
                        size="small"
                        sx={designerIconControlButtonSx}
                      >
                        <ArrowBackRoundedIcon />
                      </IconButton>
                      <IconButton
                        disabled
                        aria-label="right"
                        size="small"
                        sx={designerIconControlButtonSx}
                      >
                        <ArrowForwardRoundedIcon />
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
                          sx={designerIconControlButtonSx}
                        >
                          <ArrowBackRoundedIcon />
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
                          sx={designerIconControlButtonSx}
                        >
                          <ArrowForwardRoundedIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </>
                )}
                <Typography variant="caption" sx={designerControlLabelSx}>
                  Reorder
                </Typography>
              </Stack>

              <Typography sx={designerPipeSx}> | </Typography>

              <Button
                variant="text"
                size="small"
                color="inherit"
                startIcon={<SettingsRoundedIcon />}
                onClick={() => setSettingsOpen(true)}
                sx={designerControlLabelSx}
              >
                Settings
              </Button>

              <Typography sx={designerPipeSx}> | </Typography>

              <FormControlLabel
                sx={{
                  ml: 0.25,
                  whiteSpace: 'nowrap',
                  '& .MuiFormControlLabel-label': {
                    color: 'text.secondary',
                    fontWeight: 700,
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
                    <Typography variant="body2" sx={{fontWeight: 700}}>
                      Include "Add New Record" button
                    </Typography>
                    <Tooltip title='Controls whether users can create records from this form via "Add New Record".'>
                      <InfoIcon sx={designerInfoIconSx} />
                    </Tooltip>
                  </Stack>
                }
              />

              <Typography sx={designerPipeSx}> | </Typography>

              <Button
                variant="text"
                color="error"
                size="small"
                startIcon={<DeleteRoundedIcon />}
                onClick={deleteConfirmation}
                sx={{...designerControlLabelSx, color: 'error.main'}}
              >
                Delete
              </Button>
            </Stack>

            {editMode && (
              <>
                <Box
                  onClick={() => setEditMode(false)}
                  sx={designerInlineEditFocusOverlaySx}
                />
                <Box sx={designerInlineEditPanelSx}>
                  <form
                    onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                      e.preventDefault();
                      setEditMode(false);
                    }}
                  >
                    <SimpleFieldWrapper heading="Form Name">
                      <DebouncedTextField
                        size="small"
                        margin="none"
                        name="label"
                        data-testid="label"
                        placeholder="Form Name"
                        inputRef={formEditInputRef}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Tooltip title="Save form name">
                                <IconButton
                                  size="small"
                                  type="submit"
                                  sx={{
                                    ...designerInlineEditActionIconSx,
                                    color: 'success.main',
                                  }}
                                >
                                  <DoneRoundedIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Cancel name edit">
                                <IconButton
                                  size="small"
                                  onClick={() => setEditMode(false)}
                                  sx={{
                                    ...designerInlineEditActionIconSx,
                                    color: 'error.main',
                                  }}
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
                    </SimpleFieldWrapper>
                  </form>
                </Box>
              </>
            )}

            {alertMessage && (
              <Alert
                severity="error"
                onClose={() => setAlertMessage('')}
              >
                {alertMessage}
              </Alert>
            )}
          </Stack>
          )}
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
            <DialogTitle sx={designerDialogTitleSx}>Form Settings</DialogTitle>
            <DialogContent
              dividers
              sx={{display: 'flex', flexDirection: 'column', gap: 2}}
            >
              <FormSettingsContent viewSetId={viewSetId} />
            </DialogContent>
            <DialogActions sx={designerDialogActionsSx}>
              <Button
                sx={designerCancelButtonSx}
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            maxWidth="xs"
            aria-labelledby="alert-dialog-title"
          >
            <DialogTitle id="alert-dialog-title" sx={designerDialogTitleSx}>
              {deleteAlertTitle}
            </DialogTitle>
            <DialogContent sx={designerDialogContentSx}>
              <DialogContentText
                id="alert-dialog-description"
                sx={designerDialogBodyTextSx}
              >
                {deleteAlertMessage}
              </DialogContentText>
            </DialogContent>
            {preventDeleteDialog ? (
              <DialogActions sx={designerDialogActionsSx}>
                <Button sx={designerCancelButtonSx} onClick={handleClose}>
                  OK
                </Button>
              </DialogActions>
            ) : (
              <DialogActions sx={designerDialogActionsSx}>
                <Button sx={designerCancelButtonSx} onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={deleteForm}
                >
                  Delete
                </Button>
              </DialogActions>
            )}
          </Dialog>
          <DeletionWarningDialog
            open={showConditionAlert}
            title="Form cannot be deleted due to active references"
            references={conditionReferences}
            onClose={() => setShowConditionAlert(false)}
          />
          <Dialog
            open={addSectionDialogOpen}
            onClose={() => {
              setAddSectionDialogOpen(false);
              clearCreateSectionFlag();
            }}
            fullWidth
            maxWidth="sm"
            PaperProps={{
              sx: {
                minHeight: {xs: 280, sm: 320},
              },
            }}
          >
            <DialogTitle sx={designerDialogTitleSx}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75}}>
                <Typography variant="h6" sx={{fontWeight: 800}}>
                  Add New Section
                </Typography>
                <Tooltip title="Create a clear section name so editors can find it quickly.">
                  <InfoIcon sx={designerInfoIconSx} />
                </Tooltip>
              </Box>
            </DialogTitle>
            <DialogContent sx={{...designerDialogContentSx, pt: 4}}>
              <Box sx={{maxWidth: 740, width: '100%', mx: 'auto'}}>
                <SimpleFieldWrapper
                  heading="Section Name"
                  helperText={
                    addAlertMessage || 'Name the section users will fill in first.'
                  }
                >
                  <DebouncedTextField
                    autoFocus
                    fullWidth
                    required
                    label=""
                    placeholder="Enter section name"
                    name="sectionNameDialog"
                    data-testid="sectionNameDialog"
                    value={newSectionName}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      if (addAlertMessage) setAddAlertMessage('');
                      setNewSectionName(event.target.value);
                    }}
                    error={Boolean(addAlertMessage)}
                  />
                </SimpleFieldWrapper>
              </Box>
            </DialogContent>
            <DialogActions sx={designerDialogActionsSx}>
              <Button
                sx={designerCancelButtonSx}
                onClick={() => {
                  setAddSectionDialogOpen(false);
                  clearCreateSectionFlag();
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                disabled={!newSectionName.trim()}
                onClick={submitNewSection}
              >
                Add Section
              </Button>
            </DialogActions>
          </Dialog>

          <Box mt={2} mb={1.25}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
              <HeadingWithInfo
                title="Sections"
                tooltip="Sections break a form into logical groups of fields."
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<AddRoundedIcon />}
                onClick={() => setAddSectionDialogOpen(true)}
                sx={designerPrimaryActionButtonSx}
              >
                New Section
              </Button>
            </Box>
          </Box>
          <Box
            ref={setSectionToolbarSlot}
            sx={{
              minHeight: 0,
              '&:not(:empty)': {mb: 0.5},
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <Box sx={{px: 0, pt: 1.5, pb: 2}}>
            <Grid container spacing={2} p={0}>
              <Grid item xs={12}>
                <Box
                  ref={sectionStripRef}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: 0.75,
                    alignItems: 'flex-start',
                    mb: 1,
                    overflowX: 'auto',
                    pb: 1,
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(78, 116, 138, 0.38) transparent',
                    '&::-webkit-scrollbar': {height: hasSectionOverflow ? 8 : 0},
                    '&::-webkit-scrollbar-track': {
                      background: 'transparent',
                      borderRadius: 999,
                    },
                    '&::-webkit-scrollbar-thumb': {
                      borderRadius: 999,
                      backgroundColor: 'rgba(78, 116, 138, 0.38)',
                    },
                    '&::before, &::after': hasSectionOverflow
                      ? {
                          content: '""',
                          position: 'sticky',
                          top: 0,
                          width: 24,
                          height: '100%',
                          pointerEvents: 'none',
                          zIndex: 2,
                        }
                      : {},
                    '&::before': hasSectionOverflow
                      ? {
                          left: 0,
                          display: isSectionAtStart ? 'none' : 'block',
                          background: `linear-gradient(90deg, ${theme.palette.background.default} 40%, rgba(255,255,255,0))`,
                        }
                      : {},
                    '&::after': hasSectionOverflow
                      ? {
                          right: 0,
                          ml: 'auto',
                          display: isSectionAtEnd ? 'none' : 'block',
                          background: `linear-gradient(270deg, ${theme.palette.background.default} 40%, rgba(255,255,255,0))`,
                        }
                      : {},
                  }}
                >
                  {sections.map((section: string, index: number) => {
                    const isActive = index === activeStep;
                    const isLast = index === sections.length - 1;
                    return (
                      <Button
                        key={section}
                        variant="text"
                        onClick={handleStep(index)}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          px: 1,
                          py: 0.8,
                          minHeight: 70,
                          width: {xs: 152, sm: 170, md: 184},
                          minWidth: 148,
                          maxWidth: 220,
                          flexShrink: 0,
                          borderRadius: 2,
                          color: 'text.primary',
                          border: '1px solid',
                          borderColor: isActive
                            ? 'divider'
                            : 'transparent',
                          backgroundColor: isActive ? 'rgba(17,24,39,0.08)' : 'transparent',
                          transition:
                            'background-color 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease',
                          '& .section-step-dot': {
                            transition:
                              'transform 0.14s ease, box-shadow 0.14s ease, background-color 0.14s ease',
                            boxShadow: isActive
                              ? '0 2px 8px rgba(0,0,0,0.21)'
                              : '0 1px 2px rgba(0,0,0,0.11)',
                          },
                          '&:hover': {
                            backgroundColor: isActive ? 'rgba(17,24,39,0.11)' : 'rgba(17,24,39,0.02)',
                            borderColor: isActive ? 'divider' : 'rgba(17,24,39,0.08)',
                            boxShadow: '0 4px 10px rgba(15,23,32,0.10)',
                            '& .section-step-dot': {
                              transform: 'translateY(-1px) scale(1.02)',
                              boxShadow: '0 4px 10px rgba(15,23,32,0.2)',
                            },
                          },
                          '&:active': {
                            boxShadow: '0 2px 7px rgba(15,23,32,0.12)',
                            '& .section-step-dot': {
                              transform: 'scale(0.98)',
                            },
                          },
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                          }}
                        >
                          <Box
                            component="span"
                            className="section-step-dot"
                            sx={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.88rem',
                              bgcolor: isActive ? 'primary.main' : 'grey.400',
                              color: 'common.white',
                              flexShrink: 0,
                            }}
                          >
                            {index + 1}
                          </Box>
                          <Box
                            sx={{
                              height: 2,
                              flex: 1,
                              ml: 1,
                              background: isActive
                                ? `linear-gradient(90deg, ${theme.palette.primary.main}55 0%, ${theme.palette.primary.main}1A 100%)`
                                : 'rgba(0,0,0,0.14)',
                              borderRadius: 999,
                              opacity: isLast || sections.length <= 1 ? 0 : 1,
                              transition: 'background 0.2s ease, opacity 0.2s ease',
                            }}
                          />
                        </Box>
                        <Typography
                          title={views[section].label}
                          sx={{
                            mt: 0.85,
                            fontWeight: isActive ? 700 : 600,
                            color: isActive ? 'text.primary' : 'text.secondary',
                            fontSize: '0.95rem',
                            lineHeight: 1.25,
                            textAlign: 'left',
                            width: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {views[section].label}
                        </Typography>
                      </Button>
                    );
                  })}
                </Box>
              </Grid>

              {sections.length === 0 ? (
                addSectionDialogOpen ? null : (
                  <Grid item xs={12}>
                    <Card
                      variant="outlined"
                      sx={{
                        p: {xs: 2, sm: 2.5},
                        borderColor: 'divider',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                        maxWidth: 640,
                      }}
                    >
                      <Alert severity="success" sx={{mb: 2}}>
                        Form created. Add your first section to continue.
                      </Alert>
                      <Stack
                        direction={{xs: 'column', sm: 'row'}}
                        spacing={1.25}
                        alignItems={{xs: 'stretch', sm: 'flex-end'}}
                      >
                        <Box sx={{width: {xs: '100%', sm: 360}}}>
                          <SimpleFieldWrapper heading="Section Name">
                            <DebouncedTextField
                              required
                              label=""
                              placeholder="Enter section name"
                              name="sectionName"
                              data-testid="sectionName"
                              value={newSectionName}
                              onChange={(
                                event: React.ChangeEvent<HTMLInputElement>
                              ) => {
                                setNewSectionName(event.target.value);
                              }}
                              sx={{
                                '& .MuiInputBase-root': {paddingRight: 1},
                              }}
                            />
                          </SimpleFieldWrapper>
                        </Box>
                        <Button
                          variant="contained"
                          startIcon={<AddRoundedIcon />}
                          onClick={() => setAddSectionDialogOpen(true)}
                          sx={{height: 40, textTransform: 'none', whiteSpace: 'nowrap'}}
                        >
                          Add Section
                        </Button>
                      </Stack>
                    </Card>
                    {addAlertMessage && (
                      <Alert severity="error" sx={{mt: 2}}>
                        {addAlertMessage}
                      </Alert>
                    )}
                  </Grid>
                )
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
                    toolbarPortal={sectionToolbarSlot}
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </Grid>
      </Grid>
      {previewForm && uiSpecInternal && (
        <Box
          sx={{
            width: {xs: '38%', md: '42%', xl: '40%'},
            minWidth: {xs: 280, md: 320},
            maxWidth: {xs: 540, md: 540},
            flexShrink: 0,
            alignSelf: 'flex-start',
            position: 'sticky',
            top: 12,
            borderLeft: '2px solid',
            borderColor: 'divider',
            pl: 2.5,
          }}
        >
          {/* Preview frame */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              border: '1.5px solid',
              borderColor: theme => alpha(theme.palette.primary.main, 0.25),
              borderRadius: 2,
              overflow: 'hidden',
              backgroundColor: 'background.paper',
              boxShadow: theme => `0 2px 16px ${alpha(theme.palette.common.black, 0.07)}`,
              maxHeight: {md: 'calc(100vh - 148px)'},
            }}
          >
            {/* Accent bar */}
            <Box
              sx={{
                height: 4,
                background: theme =>
                  `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.light, 0.6)} 100%)`,
              }}
            />

            {/* Loading overlay shown while switching form tabs */}
            {previewLoading && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  bgcolor: theme => alpha(theme.palette.background.paper, 0.82),
                  backdropFilter: 'blur(2px)',
                }}
              >
                <CircularProgress size={32} thickness={4} />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Loading preview…
                </Typography>
              </Box>
            )}

            {sections.length === 0 ? (
              <Box sx={{p: 2}}>
                <Alert severity="info" sx={designerInfoCalloutSx}>
                  Add a section to see the live preview.
                </Alert>
              </Box>
            ) : (
              <Box key={viewSetId} sx={{maxHeight: {md: 'calc(100vh - 196px)'}, overflow: 'auto'}}>
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
                    previewSectionId={sections[activeStep]}
                  />
                </ThemeProvider>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Stack>
  );
};
