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

import { Grid, Alert, Stepper, Typography, Step, Button, StepButton, 
         TextField, Dialog, DialogTitle, DialogActions, DialogContent, 
         DialogContentText, Card, InputAdornment, Tooltip, IconButton, 
         Checkbox, FormControlLabel } from "@mui/material";

import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

import { useAppDispatch, useAppSelector } from "../state/hooks";
import { SectionEditor } from "./section-editor";
import { useState } from "react";
import { shallowEqual } from "react-redux";
import { Notebook } from "../state/initial";

type Props = {
    viewSetId: string,
    moveCallback: (viewSetID: string, moveDirection: 'left' | 'right') => void,
    moveButtonsDisabled: boolean,
    handleChangeCallback: (viewSetID: string, ticked: boolean) => void,
    handleDeleteCallback: (viewSetID: string) => void,
}

export const FormEditor = ({ viewSetId, moveCallback, moveButtonsDisabled, handleChangeCallback, handleDeleteCallback }: Props) => {

    const visibleTypes = useAppSelector((state: Notebook) => state['ui-specification'].visible_types);
    const viewsets = useAppSelector((state: Notebook) => state['ui-specification'].viewsets);
    const viewSet = useAppSelector((state: Notebook) => state['ui-specification'].viewsets[viewSetId],
        (left, right) => {
            return shallowEqual(left, right);
        });
    const views = useAppSelector((state: Notebook) => state['ui-specification'].fviews);
    const fields = useAppSelector((state: Notebook) => state['ui-specification'].fields);
    const dispatch = useAppDispatch();

    console.log('FormEditor', viewSetId);
    console.log('FormEditor visible_types', visibleTypes);

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
    const [initialIndex, setInitialIndex] = useState(visibleTypes.indexOf(viewSetId));

    const handleStep = (step: number) => () => {
        setActiveStep(step);
    }

    const handleClose = () => {
        setOpen(false);
    }

    const handleChange = (ticked: boolean) => {
        // there must be >1 forms in the notebook, and, therefore, >1 visible forms, in order to be able to untick the checkbox
        if ((Object.keys(viewsets).length > 1 && visibleTypes.length > 1) || ticked) {
            setAlertMessage('');

            dispatch({ type: 'ui-specification/formVisibilityUpdated', payload: { viewSetId, ticked, initialIndex } });

            handleChangeCallback(viewSetId, ticked);
        }
        // in the case that there are multiple forms in the notebook, but none are visible, allow to re-tick the checkbox
        else if (visibleTypes.length === 0) {
            setAlertMessage('');
            setChecked(ticked)
            setInitialIndex(0)

            dispatch({ type: 'ui-specification/formVisibilityUpdated', payload: { viewSetId, ticked: checked, initialIndex: initialIndex } });

            handleChangeCallback(viewSetId, checked);
        }
        else {
            setAlertMessage(`This must remain ticked in at least one (1) form.`);
        }
    }

    const deleteSection = (viewSetID: string, viewID: string) => {
        dispatch({ type: 'ui-specification/sectionDeleted', payload: { viewSetID, viewID } });

        // making sure the stepper jumps steps (forward or backward) intuitively 
        if (viewSet.views[viewSet.views.length - 1] === viewID && viewSet.views.length > 1) {
            setActiveStep(activeStep - 1)
        }
    }

    const moveSection = (viewSetID: string, viewID: string, moveDirection: 'left' | 'right') => {
        if (moveDirection === 'left') {
            dispatch({ type: 'ui-specification/sectionMoved', payload: { viewSetId: viewSetID, viewId: viewID, direction: 'left' } });

            // making sure the stepper jumps a step backward intuitively 
            setActiveStep(activeStep - 1);
        }
        else {
            dispatch({ type: 'ui-specification/sectionMoved', payload: { viewSetId: viewSetID, viewId: viewID, direction: 'right' } });

            // making sure the stepper jumps a step forward intuitively 
            setActiveStep(activeStep + 1);
        }
    }

    const addNewSection = (viewSetID: string, label: string) => {
        try {
            dispatch({ type: 'ui-specification/sectionAdded', payload: { viewSetId: viewSetID, sectionLabel: label } });

            // jump to the newly created section (i.e., to the end of the stepper)
            setActiveStep(viewSet.views.length);
            setAddAlertMessage('');

            // let sectionEditor component know a section was addedd successfully
            return true;
        }
        catch (error: unknown) {
            error instanceof Error && setAddAlertMessage(error.message);
        }
        return false;
    }

    const updateFormLabel = (label: string) => {
        dispatch({ type: 'ui-specification/viewSetRenamed', payload: { viewSetId, label } });
    }

    const deleteConfirmation = () => {
        setOpen(true);
        setPreventDeleteDialog(false);
        setDeleteAlertTitle(`Are you sure you want to delete this form?`);
        setDeleteAlertMessage(`All fields in the form will also be deleted.`);
    }

    const findRelatedFieldLocation = (fieldName: string | undefined) => {
        // making fviews iterable
        const fviewsEntries = Object.entries(views)
        fviewsEntries.forEach((_viewId, idx) => {
            // iterating over every section's fields array to find fieldName
            fviewsEntries[idx][1].fields.forEach((field) => {
                if (field === fieldName) {
                    // extracting which section fieldName belongs to
                    const sectionToFind = fviewsEntries[idx][0];
                    // making viewsets iterable
                    const viewsetsEntries = Object.entries(viewsets);
                    viewsetsEntries.forEach((_viewSetId, idx) => {
                        // iterating over every form's views array to find the section
                        viewsetsEntries[idx][1].views.forEach((view) => {
                            if (view === sectionToFind) {
                                // we made it! now extract the form and section labels
                                const formLabel: string = viewsetsEntries[idx][1].label;
                                const sectionLabel: string = fviewsEntries[idx][1].label;

                                // setting the dialog text here
                                setDeleteAlertTitle(`Form cannot be deleted.`);
                                setDeleteAlertMessage(`Please update the field '${fieldName}', found in form ${formLabel} section ${sectionLabel}, to remove the reference to allow this form to be deleted.`);
                            }
                        })
                    })
                }
            })
        })
    }

    const preventFormDelete = () => {
        // we don't need the field keys, only their values
        const fieldValues = Object.values(fields)
        let flag: boolean = false;
        // search through all the values for mention of the form to be deleted in the related_type param
        fieldValues.forEach((fieldValue) => {
            if (fieldValue["component-parameters"].related_type === viewSetId) {
                flag = true;
                // extracting the name of the field to advise the user
                const relatedFieldName = fieldValue["component-parameters"].name;
                // finding the exact location of the field in the notebook to advise the user
                findRelatedFieldLocation(relatedFieldName);
            }
        })
        return flag;
    }

    const deleteForm = () => {
        // SANITY CHECK. Don't allow the user to delete the form if they've used it in a RelatedRecordSelector field
        if (preventFormDelete()) {
            setOpen(true);
            setPreventDeleteDialog(true);
        }
        else {
            handleDeleteCallback(viewSetId);
            dispatch({ type: 'ui-specification/viewSetDeleted', payload: { viewSetId: viewSetId } });
            handleClose();
        }
    }

    const moveForm = (viewSetID: string, moveDirection: 'left' | 'right') => {
        moveCallback(viewSetID, moveDirection)
    }


    return (
        <Grid container spacing={2} pt={3}>
            <Grid container item xs={12} spacing={1.75}>
                <Grid item xs={12} sm={2}>
                    <Button variant="text" color="error" size="medium" startIcon={<DeleteRoundedIcon />} onClick={deleteConfirmation}>
                        Delete form
                    </Button>
                    <Dialog
                        open={open}
                        onClose={handleClose}
                        aria-labelledby="alert-dialog-title"
                        aria-describedby="alert-dialog-description"
                    >
                        <DialogTitle id="alert-dialog-title">
                            {deleteAlertTitle}
                        </DialogTitle>
                        <DialogContent>
                            <DialogContentText id="alert-dialog-description">
                                {deleteAlertMessage}
                            </DialogContentText>
                        </DialogContent>
                        {preventDeleteDialog ?
                            <DialogActions>
                                <Button onClick={handleClose}>OK</Button>
                            </DialogActions>
                            :
                            <DialogActions>
                                <Button onClick={deleteForm}>Yes</Button>
                                <Button onClick={handleClose}>No</Button>
                            </DialogActions>
                        }
                    </Dialog>
                </Grid>

                <Grid item xs={12} sm={3}>
                    <Button variant="text" size="medium" startIcon={<EditRoundedIcon />} onClick={() => setEditMode(true)}>
                        Edit form name
                    </Button>
                    {editMode &&
                        <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                            e.preventDefault();
                            setEditMode(false);
                        }}>
                            <TextField
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
                                                <IconButton size="small" onClick={() => setEditMode(false)}>
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
                                sx={{ '& .MuiInputBase-root': { paddingRight: 0 } }}
                            />
                        </form>
                    }
                </Grid>

                {moveButtonsDisabled ?
                    (
                        <Grid item xs={12} sm={3}>
                            <Tooltip title='Only forms with an "Add New Record" button can be re-ordered.'>
                                <span>
                                    <IconButton
                                        disabled={true}
                                        aria-label='left' size='medium'>
                                        <ArrowBackRoundedIcon />
                                    </IconButton>
                                    <IconButton
                                        disabled={true}
                                        aria-label='right' size='medium'>
                                        <ArrowForwardRoundedIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Grid>
                    ) :
                    (
                        <Grid item xs={12} sm={3}>
                            <Tooltip title='Move form left'>
                                <span>
                                    <IconButton
                                        disabled={visibleTypes.indexOf(viewSetId) === 0}
                                        onClick={() => moveForm(viewSetId, 'left')}
                                        aria-label='left' size='medium'>
                                        <ArrowBackRoundedIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title='Move form right'>
                                <span>
                                    <IconButton
                                        disabled={visibleTypes.indexOf(viewSetId) === (visibleTypes.length - 1)}
                                        onClick={() => moveForm(viewSetId, 'right')}
                                        aria-label='right' size='medium'>
                                        <ArrowForwardRoundedIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Grid>
                    )
                }

                <Grid item xs={12} sm={4}>
                    <FormControlLabel
                        control={<Checkbox
                            checked={visibleTypes.includes(viewSetId)}
                            size="small"
                            onChange={(e) => handleChange(e.target.checked)}
                        />}
                        label={`Include "Add New Record" button`}
                    />
                    {alertMessage && <Alert severity="error">{alertMessage}</Alert>}
                </Grid>
            </Grid>

            <Grid item xs={12}>
                <Card variant="outlined">
                    <Grid container spacing={2} p={3}>
                        <Grid item xs={12}>
                            <Stepper nonLinear activeStep={activeStep} alternativeLabel sx={{ my: 3 }}>
                                {viewSet.views.map((view: string, index: number) => (
                                    <Step key={view}>
                                        <StepButton color="inherit" onClick={handleStep(index)}>
                                            <Typography>{views[view].label}</Typography>
                                        </StepButton>
                                    </Step>
                                ))}
                            </Stepper>
                        </Grid>

                        {activeStep === viewSet.views.length ? (
                            <Grid item xs={12}>
                                <Grid container justifyContent="center"
                                    alignItems="center" item xs={12} direction="column">
                                    <Alert severity="success">Form has been created. Add a section to get started.</Alert>
                                    <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                                        e.preventDefault();
                                        addNewSection(viewSetId, newSectionName);
                                    }}>
                                        <TextField
                                            required
                                            label="Section Name"
                                            name="sectionName"
                                            data-testid="sectionName"
                                            value={newSectionName}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                                setNewSectionName(event.target.value);
                                            }}
                                            sx={{ '& .MuiInputBase-root': { paddingRight: 1 }, mt: 3 }}
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
                                {addAlertMessage && <Alert severity="error">{addAlertMessage}</Alert>}
                            </Grid>
                        ) :
                            (
                                <Grid item xs={12}>
                                    <SectionEditor viewSetId={viewSetId} viewId={viewSet.views[activeStep]} viewSet={viewSet} deleteCallback={deleteSection} addCallback={addNewSection} moveCallback={moveSection} />
                                </Grid>
                            )
                        }
                    </Grid>
                </Card>
            </Grid>
        </Grid>
    );
}