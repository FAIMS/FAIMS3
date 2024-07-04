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

import { Grid, TextField, Button, Dialog, DialogActions, DialogTitle, InputAdornment, Tooltip, IconButton, Alert} from "@mui/material";
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

import { FieldList } from "./field-list";
import { useAppSelector, useAppDispatch } from "../state/hooks";
import { Notebook } from '../state/initial';
import { useState } from "react";
import {ConditionModal, ConditionTranslation, ConditionType } from "./condition";

type Props = {
    viewSetId: string,
    viewId: string,
    viewSet: {
        views: string[];
        label: string;
    }
    deleteCallback: (viewSetID: string, viewID: string) => void,
    addCallback: (viewSetID: string, label: string) => boolean,
    moveCallback: (viewSetID: string, viewID: string, moveDirection: 'left' | 'right') => void
};

export const SectionEditor = ({ viewSetId, viewId, viewSet, deleteCallback, addCallback, moveCallback }: Props) => {

    const fView = useAppSelector((state: Notebook) => state['ui-specification'].fviews[viewId]);
    const dispatch = useAppDispatch();

    console.log('SectionEditor', viewId, viewSet);

    const [open, setOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [addMode, setAddMode] = useState(false);
    const [newSectionName, setNewSectionName] = useState('New Section');
    const [addAlertMessage, setAddAlertMessage] = useState('');

    const handleClose = () => {
        setOpen(false);
    }

    const deleteSection = () => {
        deleteCallback(viewSetId, viewId);
        handleClose();
    }

    const updateSectionLabel = (label: string) => {
        dispatch({ type: 'ui-specification/sectionRenamed', payload: { viewId, label } });
    }

    const addNewSection = () => {
        // run the function to add a new section AND save the returned success status to a variable
        const addSuccess: boolean = addCallback(viewSetId, newSectionName);

        // depending on addSuccess, set relevant state variables
        if (addSuccess) {
            setAddMode(false);
            setAddAlertMessage('');
        }
        else {
            // manually setting the error message
            setAddAlertMessage(`Section ${newSectionName} already exists in this form.`)
        }
    }

    const moveSection = (moveDirection: 'left' | 'right') => {
        moveCallback(viewSetId, viewId, moveDirection);
    }

    const conditionChanged = (condition: ConditionType | null) => {
        console.log('condition changed', condition);
        dispatch({ type: 'ui-specification/sectionConditionChanged', payload: { viewId, condition } });
    }

    return (
        <>
            <Grid container spacing={1.75} mb={2}>
                <Grid item xs={12} sm={3}>
                    <Button variant="text" color="error" size="small" startIcon={<DeleteRoundedIcon />} onClick={() => setOpen(true)}>
                        Delete section
                    </Button>
                    <Dialog
                        open={open}
                        onClose={handleClose}
                        aria-labelledby="alert-dialog-title"
                        aria-describedby="alert-dialog-description"
                    >
                        <DialogTitle id="alert-dialog-title">
                            Are you sure you want to delete this section?
                        </DialogTitle>
                        <DialogActions>
                            <Button onClick={deleteSection}>Yes</Button>
                            <Button onClick={handleClose}>No</Button>
                        </DialogActions>
                    </Dialog>
                </Grid>

                <Grid item xs={12} sm={2}>
                    <Button variant="text" size="small" startIcon={<EditRoundedIcon />} onClick={() => setEditMode(true)}>
                        Edit section name
                    </Button>
                    {editMode &&
                        <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                            e.preventDefault();
                            setEditMode(false);
                        }}>
                            <TextField
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
                                                <IconButton size="small" onClick={() => setEditMode(false)}>
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
                                sx={{ '& .MuiInputBase-root': { paddingRight: 0 } }}
                            />
                        </form>
                    }
                </Grid>

                <Grid item xs={12} sm={2}>
                    <Tooltip title='Move section left'>
                        <span>
                            <IconButton disabled={viewSet.views.indexOf(viewId) === 0 ? true : false} onClick={() => moveSection('left')} aria-label='left' size='small'>
                                <ArrowBackRoundedIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title='Move section right'>
                        <span>
                            <IconButton disabled={viewSet.views.indexOf(viewId) === (viewSet.views.length - 1) ? true : false} onClick={() => moveSection('right')} aria-label='right' size='small'>
                                <ArrowForwardRoundedIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Grid>

                <Grid item xs={12} sm={2}>
                    <Button variant="text" size="small" startIcon={<AddCircleOutlineRoundedIcon />} onClick={() => setAddMode(true)}>
                        Add new section
                    </Button>
                    {addMode &&
                        <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                            e.preventDefault();
                            addNewSection();
                        }}>
                            <TextField
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
                                                <IconButton size="small" onClick={() => {
                                                    setAddMode(false);
                                                    setAddAlertMessage('');
                                                }}>
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
                                sx={{ '& .MuiInputBase-root': { paddingRight: 0 } }}
                            />
                        </form>
                    }
                    {addAlertMessage && <Alert severity="error">{addAlertMessage}</Alert>}
                </Grid>

                <Grid item xs={12} sm={3}>
                    <ConditionModal 
                        label={fView.condition ? "Update Condition" : "Add Condition"}
                        initial={fView.condition} 
                        onChange={conditionChanged}
                        view={viewId} />
                </Grid>
                
            </Grid>

            <Grid>
                {fView.condition ? 
                        (<Alert severity="info"><strong>Section Condition:</strong> Show this section if&nbsp;
                            <ConditionTranslation condition={fView.condition}/></Alert>)
                        : (<></>)}
            </Grid>
            <FieldList viewId={viewId} viewSetId={viewSetId} />
        </>
    );
}