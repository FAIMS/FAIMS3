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

import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import MoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Tooltip,
  Typography,
} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {sectionDuplicated} from '../state/uiSpec-reducer';

import {ConditionModal} from './condition/ConditionModal';
import {ConditionTranslation} from './condition/ConditionTranslation';
import {findSectionExternalUsage} from './condition/utils';
import {ConditionType} from './condition/types';

import DebouncedTextField from './debounced-text-field';
import {DeletionWarningDialog} from './deletion-warning-dialog';
import {FieldList} from './field-list';

type Props = {
  viewSetId: string;
  viewId: string;
  viewSet: {
    views: string[];
    label: string;
  };
  deleteCallback: (viewSetID: string, viewID: string) => void;
  addCallback: (viewSetID: string, label: string) => boolean;
  moveCallback: (
    viewSetID: string,
    viewID: string,
    moveDirection: 'left' | 'right'
  ) => void;
  moveSectionCallback: (
    sourceViewSetID: string,
    targetViewSetID: string,
    viewID: string
  ) => boolean;
  handleSectionMoveCallback: (targetViewSetId: string) => void;
  moveFieldCallback: (targetViewId: string) => void;
};

export const SectionEditor = ({
  viewSetId,
  viewId,
  viewSet,
  deleteCallback,
  moveSectionCallback,
  addCallback,
  moveCallback,
  handleSectionMoveCallback,
  moveFieldCallback,
}: Props) => {
  const fView = useAppSelector(
    state => state.notebook['ui-specification'].present.fviews[viewId]
  );
  const viewSets = useAppSelector(
    state => state.notebook['ui-specification'].present.viewsets
  );
  const allFviews = useAppSelector(
    state => state.notebook['ui-specification'].present.fviews
  );
  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].present.fields
  );

  const dispatch = useAppDispatch();

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openMoveDialog, setOpenMoveDialog] = useState(false);
  const [targetViewSetId, setTargetViewSetId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newSectionName, setNewSectionName] = useState('New Section');
  const [addAlertMessage, setAddAlertMessage] = useState('');
  const [showConditionAlert, setShowConditionAlert] = useState(false);
  const [conditionReferences, setConditionReferences] = useState<string[]>([]);

  const [openDuplicateDialog, setOpenDuplicateDialog] = useState(false);
  const [duplicateSectionName, setDuplicateSectionName] = useState(
    fView.label + ' copy'
  );
  const [duplicateTargetViewSetId, setDuplicateTargetViewSetId] = useState('');
  const [duplicateAlertMessage, setDuplicateAlertMessage] = useState('');

  useEffect(() => {
    if (fView) {
      setDuplicateSectionName(fView.label + ' copy');
    }
  }, [fView]);

  const duplicateFormOptions = useMemo(
    () =>
      Object.entries(viewSets).map(([formId, form]) => ({
        id: formId,
        label: form.label,
      })),
    [viewSets]
  );

  const duplicateFormValue = useMemo(() => {
    const formId = duplicateTargetViewSetId || viewSetId;
    return {id: formId, label: viewSets[formId].label};
  }, [duplicateTargetViewSetId, viewSetId, viewSets]);

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
  };

  const handleCloseMoveDialog = () => {
    setOpenMoveDialog(false);
    setTargetViewSetId('');
  };

  const deleteConfirmation = () => {
    // check if other sections/fields are referencing the fields in this section
    const references = findSectionExternalUsage(viewId, allFviews, allFields);

    if (references.length > 0) {
      // show our references alert if not empty
      setConditionReferences(references);
      setShowConditionAlert(true);
    } else {
      // otherwise, open old "Are you sure?" dialog
      setOpenDeleteDialog(true);
    }
  };

  const deleteSection = () => {
    deleteCallback(viewSetId, viewId);
    handleCloseDeleteDialog();
  };

  // close condition reference dialog
  const handleCloseConditionAlert = () => {
    setShowConditionAlert(false);
  };

  // memoize the form value
  const formValue = useMemo(
    () =>
      targetViewSetId
        ? {id: targetViewSetId, label: viewSets[targetViewSetId].label}
        : null,
    [targetViewSetId, viewSets]
  );

  // memoize the form options
  const formOptions = useMemo(
    () =>
      Object.entries(viewSets)
        .filter(([formId]) => formId !== viewSetId) // exclude the source form
        .map(([formId, form]) => ({
          id: formId,
          label: form.label,
        })),
    [viewSets, viewSetId]
  );

  const moveSectionToForm = () => {
    // run the function to move the section to a different form AND save the returned success status to a variable
    const moveSuccess: boolean = moveSectionCallback(
      viewSetId,
      targetViewSetId,
      viewId
    );

    // depending on moveSuccess, set relevant state variables
    if (moveSuccess) {
      setAddAlertMessage('');
      handleSectionMoveCallback(targetViewSetId);
    } else {
      // manually setting the error message
      setAddAlertMessage('Failed to move the section to this form.');
    }

    handleCloseMoveDialog();
  };

  const updateSectionLabel = (label: string) => {
    dispatch({
      type: 'ui-specification/sectionRenamed',
      payload: {viewId, label},
    });
  };

  const addNewSection = () => {
    // run the function to add a new section AND save the returned success status to a variable
    const addSuccess: boolean = addCallback(viewSetId, newSectionName);

    // depending on addSuccess, set relevant state variables
    if (addSuccess) {
      setAddMode(false);
      setAddAlertMessage('');
    } else {
      // manually setting the error message
      setAddAlertMessage(
        `Section ${newSectionName} already exists in this form.`
      );
    }
  };

  const moveSection = (moveDirection: 'left' | 'right') => {
    moveCallback(viewSetId, viewId, moveDirection);
  };

  const conditionChanged = (condition: ConditionType | null) => {
    dispatch({
      type: 'ui-specification/sectionConditionChanged',
      payload: {viewId, condition},
    });
  };

  const duplicateSection = () => {
    const targetForm = duplicateTargetViewSetId || viewSetId;
    try {
      dispatch(
        sectionDuplicated({
          sourceViewId: viewId,
          destinationViewSetId: targetForm,
          newSectionLabel: duplicateSectionName.trim(),
        })
      );
      setOpenDuplicateDialog(false);
      setDuplicateAlertMessage('');
    } catch (error: unknown) {
      setDuplicateAlertMessage(
        error instanceof Error ? error.message : 'Error duplicating section.'
      );
    }
  };

  return (
    <>
      <Grid container spacing={1.75} mb={2}>
        <Grid item xs={12} sm={1.9}>
          <Button
            variant="text"
            color="error"
            size="small"
            startIcon={<DeleteRoundedIcon />}
            onClick={deleteConfirmation}
          >
            Delete section
          </Button>
          <Dialog
            open={openDeleteDialog}
            onClose={handleCloseDeleteDialog}
            aria-labelledby="alert-delete-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-delete-dialog-title">
              Are you sure you want to delete this section?
            </DialogTitle>
            <DialogActions>
              <Button onClick={deleteSection}>Yes</Button>
              <Button onClick={handleCloseDeleteDialog}>No</Button>
            </DialogActions>
          </Dialog>
          <DeletionWarningDialog
            open={showConditionAlert}
            title="Cannot delete this section"
            references={conditionReferences}
            onClose={handleCloseConditionAlert}
          />
        </Grid>

        {/* Duplicate Section Button */}
        <Grid item xs={12} sm={1.9}>
          <Button
            variant="text"
            size="small"
            startIcon={<ContentCopyRoundedIcon />}
            onClick={() => setOpenDuplicateDialog(true)}
          >
            Duplicate section
          </Button>
        </Grid>

        <Grid item xs={12} sm={1.9}>
          <Button
            variant="text"
            size="small"
            startIcon={<MoveRoundedIcon />}
            onClick={() => setOpenMoveDialog(true)}
          >
            Move section
          </Button>
          <Dialog
            open={openMoveDialog}
            onClose={handleCloseMoveDialog}
            aria-labelledby="alert-move-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-move-dialog-title" textAlign="center">
              Move Section
            </DialogTitle>
            <DialogContent>
              <Typography
                variant="body1"
                sx={{mt: 0.5, mb: 1, fontWeight: 450}}
              >
                Destination Form
              </Typography>
              <Typography variant="body2" sx={{mb: 1}}>
                Choose the form you want to move the section to.
              </Typography>
              <Autocomplete
                fullWidth
                value={formValue}
                onChange={(_event, newValue) => {
                  setTargetViewSetId(newValue ? newValue.id : '');
                }}
                options={formOptions}
                getOptionLabel={option => option.label}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={params => (
                  <DebouncedTextField
                    {...params}
                    onChange={event => setTargetViewSetId(event.target.value)}
                  />
                )}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseMoveDialog}>Cancel</Button>
              <Button onClick={moveSectionToForm} disabled={!targetViewSetId}>
                Move
              </Button>
            </DialogActions>
          </Dialog>
        </Grid>

        <Grid item xs={12} sm={1.9}>
          <Button
            variant="text"
            size="small"
            startIcon={<EditRoundedIcon />}
            onClick={() => setEditMode(true)}
          >
            Edit section name
          </Button>
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
                label="Section Name"
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
                value={fView.label}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  updateSectionLabel(event.target.value);
                }}
                sx={{'& .MuiInputBase-root': {paddingRight: 0}}}
              />
            </form>
          )}
        </Grid>

        <Grid item xs={12} sm={1.5}>
          <Tooltip title="Move section left">
            <span>
              <IconButton
                disabled={viewSet.views.indexOf(viewId) === 0 ? true : false}
                onClick={() => moveSection('left')}
                aria-label="left"
                size="small"
              >
                <ArrowBackRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Move section right">
            <span>
              <IconButton
                disabled={
                  viewSet.views.indexOf(viewId) === viewSet.views.length - 1
                    ? true
                    : false
                }
                onClick={() => moveSection('right')}
                aria-label="right"
                size="small"
              >
                <ArrowForwardRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Grid>

        <Grid item xs={12} sm={2.5}>
          <Button
            variant="text"
            size="small"
            startIcon={<AddCircleOutlineRoundedIcon />}
            onClick={() => setAddMode(true)}
          >
            Add new section
          </Button>
          {addMode && (
            <form
              onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                addNewSection();
              }}
            >
              <DebouncedTextField
                required
                fullWidth
                size="small"
                margin="dense"
                label="New Section Name"
                name="sectionName"
                data-testid="sectionName"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Add">
                        <IconButton size="small" type="submit">
                          <AddRoundedIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Close">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setAddMode(false);
                            setAddAlertMessage('');
                          }}
                        >
                          <CloseRoundedIcon />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                value={newSectionName}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setNewSectionName(event.target.value);
                }}
                sx={{'& .MuiInputBase-root': {paddingRight: 0}}}
              />
            </form>
          )}
          {addAlertMessage && <Alert severity="error">{addAlertMessage}</Alert>}
        </Grid>

        <Grid item xs={12} sm={2}>
          <ConditionModal
            label={fView.condition ? 'Update Condition' : 'Add Condition'}
            initial={fView.condition}
            onChange={conditionChanged}
            view={viewId}
          />
        </Grid>
      </Grid>
      <Dialog
        open={openDuplicateDialog}
        onClose={() => {
          setOpenDuplicateDialog(false);
          setDuplicateAlertMessage('');
        }}
        fullWidth
        maxWidth="md"
        PaperProps={{style: {minWidth: '600px'}}}
        aria-labelledby="duplicate-section-dialog-title"
        aria-describedby="duplicate-section-dialog-description"
      >
        <DialogTitle id="duplicate-section-dialog-title">
          Duplicate Section
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{mt: 0.5, mb: 1, fontWeight: 450}}>
            New Section Name
          </Typography>
          <DebouncedTextField
            fullWidth
            value={duplicateSectionName}
            onChange={e => setDuplicateSectionName(e.target.value)}
          />
          <Typography variant="body1" sx={{mt: 2, mb: 1, fontWeight: 450}}>
            Destination Form
          </Typography>
          <Autocomplete
            fullWidth
            disableClearable
            value={duplicateFormValue}
            onChange={(_event, newValue) => {
              setDuplicateTargetViewSetId(newValue ? newValue.id : viewSetId);
            }}
            options={duplicateFormOptions}
            getOptionLabel={option => option.label}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={params => (
              <DebouncedTextField {...params} onChange={() => {}} />
            )}
          />
          {duplicateAlertMessage && (
            <Alert severity="error">{duplicateAlertMessage}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenDuplicateDialog(false);
              setDuplicateAlertMessage('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={duplicateSection}
            disabled={!duplicateSectionName.trim()}
          >
            Duplicate
          </Button>
        </DialogActions>
      </Dialog>
      <Grid>
        {fView.condition ? (
          <Alert severity="info">
            <strong>Section Condition:</strong> Show this section if&nbsp;
            <ConditionTranslation condition={fView.condition} />
          </Alert>
        ) : (
          <></>
        )}
      </Grid>
      <FieldList
        viewId={viewId}
        viewSetId={viewSetId}
        moveFieldCallback={moveFieldCallback}
      />
    </>
  );
};
