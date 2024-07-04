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

import { Grid, Card, FormHelperText, FormControl, FormControlLabel, Checkbox, InputLabel, Select, MenuItem, Alert, TextField, List, ListItem, IconButton, Button, ListItemText } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';

import { useState } from "react";
import { useAppSelector, useAppDispatch } from "../../state/hooks";
import { BaseFieldEditor } from "./BaseFieldEditor";
import { FieldType, Notebook } from "../../state/initial";

type PairList = [string, string][];
type Props = {
    fieldName: string,
};

export const RelatedRecordEditor = ({ fieldName }: Props) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const viewsets = useAppSelector((state: Notebook) => state['ui-specification'].viewsets);
    const dispatch = useAppDispatch();

    const [newOption1, setNewOption1] = useState('')
    const [newOption2, setNewOption2] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    // returns array of key-value pairs (entries) with format: [[string, {}]]
    const arrOfEntries = Object.entries(viewsets);

    const getPairs = () => {
        let pairs: PairList = [];
        if (field['component-parameters'].relation_linked_vocabPair) {
            pairs = field['component-parameters'].relation_linked_vocabPair;
        }
        return pairs;
    }

    const pairs = getPairs()

    // initial value of each property
    const state = {
        multiple: field['component-parameters'].multiple as boolean || false,
        relatedType: field['component-parameters'].related_type as string || '',
        relatedTypeLabel: field['component-parameters'].related_type_label as string || '',
        relationType: field['component-parameters'].relation_type as string || '',
        relationLinkedPair: field['component-parameters'].relation_linked_vocabPair as PairList || []
    }

    type newState = {
        multiple: boolean,
        relatedType: string,
        relatedTypeLabel: string,
        relationType: string,
        relationLinkedPair: PairList,
    }

    const updateField = (fieldName: string, newField: FieldType) => {
        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } })
    }

    const updateFieldFromState = (newState: newState) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy

        newField['component-parameters'].multiple = newState.multiple;
        newField['component-parameters'].related_type = newState.relatedType;
        newField['component-parameters'].related_type_label = newState.relatedTypeLabel;
        newField['component-parameters'].relation_type = newState.relationType;
        newField['component-parameters'].relation_linked_vocabPair = newState.relationLinkedPair;

        updateField(fieldName, newField);
    }

    const updateProperty = (prop: string, value: string | boolean | string[] | PairList) => {
        if (prop === 'relatedType') {
            arrOfEntries.forEach((key) => {
                if (key.indexOf(value as string) === 0) {
                    // update the related_type prop along with the related_type_label prop
                    const newState: newState = { ...state, relatedType: value as string, relatedTypeLabel: key[1].label }
                    updateFieldFromState(newState);
                }
            })
        } else {
            const newState: newState = { ...state, [prop]: value }
            updateFieldFromState(newState);
        }
    }

    const addPair = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const empty = () => {
            if (newOption1.trim().length == 0 || newOption2.trim().length == 0) {
                return true;
            } else
                return false;
        }

        // TO DO: duplicates check, both between other sub-arrays and within own pair 

        if (empty()) {
            setErrorMessage('Cannot add an empty option!')
        } else {
            const newPairs: PairList = [...pairs, [newOption1, newOption2]]
            updateProperty('relationLinkedPair', newPairs)
            setErrorMessage('')
        }
        setNewOption1('')
        setNewOption2('')
    }

    const removePair = (pair: string[]) => {
        // inspired by https://stackoverflow.com/questions/62629289/remove-subarray-from-array-in-javascript
        const newPairs = [];
        for (let i = 0; i < pairs.length; i++) {
            if (pairs[i].length !== pair.length || !pair.every((item, j) => item === pairs[i][j])) {
                newPairs.push(pairs[i]);
            }
        }
        updateProperty('relationLinkedPair', newPairs)
    }

    return (
        <BaseFieldEditor fieldName={fieldName}>
            <Grid item xs={12}>
                <Card variant="outlined">
                    <Grid container p={2} rowSpacing={3}>
                        <Grid item xs={12} sm={4}>
                            <FormControlLabel
                                required
                                control={
                                    <Checkbox
                                        checked={state.multiple}
                                        onChange={(e) => updateProperty('multiple', e.target.checked)}
                                    />
                                }
                                label="Multiple"
                            />
                            <FormHelperText>
                                Tick if user can add multiple records for this relationship.
                            </FormHelperText>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                            <FormControl required sx={{ minWidth: 150 }}>
                                <InputLabel id="featureType-label">Select Relation Type</InputLabel>
                                <Select
                                    labelId="featureType-label"
                                    label="Select Relation Type *"
                                    value={state.relationType}
                                    onChange={(e) => updateProperty('relationType', e.target.value)}
                                >
                                    <MenuItem value="faims-core::Child">Child</MenuItem>
                                    <MenuItem value="faims-core::Linked">Linked</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                            <FormControl required sx={{ minWidth: 150 }}>
                                <InputLabel id="relatedType-label">Select Related Form</InputLabel>
                                <Select
                                    labelId="relatedType-label"
                                    label="Select Related Form *"
                                    value={state.relatedType}
                                    onChange={(e) => updateProperty('relatedType', e.target.value)}
                                >
                                    {arrOfEntries.map((entry) => {
                                        return (
                                            <MenuItem
                                                key={entry[0]}
                                                value={entry[0]}
                                            >
                                                {entry[1].label}
                                            </MenuItem>
                                        )
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Card>
            </Grid>

            {state.relationType === 'faims-core::Linked' &&
                // TO DO: fix layout (I think it's confusing as it is right now, needs more user guidance)
                <Grid item xs={12}>
                    <Card variant="outlined" sx={{ display: 'flex' }}>
                        <Grid container p={2} columnSpacing={3} rowSpacing={3}>
                            <Grid item xs={12} sm={6}>
                                <Alert severity="info">Add and remove Linking Pairs as needed.</Alert>
                                <form onSubmit={addPair}>
                                    <Grid container item style={{ display: "flex" }} direction={{ xs: 'column', sm: 'row' }}>
                                        <TextField
                                            label="Performed Before"
                                            value={newOption1}
                                            onChange={(e) => setNewOption1(e.target.value)}
                                            sx={{ my: 1.5 }}
                                        />
                                        <TextField
                                            label="Performed After"
                                            value={newOption2}
                                            onChange={(e) => setNewOption2(e.target.value)}
                                            sx={{ my: 1.5 }}
                                        />
                                        <Button
                                            color="primary"
                                            startIcon={<AddCircleIcon />}
                                            variant="outlined"
                                            type="submit"
                                            sx={{ my: 1.5 }}
                                        >
                                            ADD{' '}
                                        </Button>
                                    </Grid>
                                </form>
                                {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <List>
                                    {pairs.map((outer: string[], idx: number) => {
                                        return (
                                            <ListItem
                                                key={idx}
                                                secondaryAction={
                                                    <IconButton
                                                        edge="end"
                                                        aria-label="delete"
                                                        onClick={() => removePair(outer)}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                }
                                            >
                                                {pairs[idx].map((inner: string, idx: number) => {
                                                    return (
                                                        <ListItemText key={idx} primary={inner} />
                                                    )
                                                })}
                                            </ListItem>
                                        )
                                    })}
                                </List>
                            </Grid>
                        </Grid>
                    </Card>
                </Grid>
            }
        </BaseFieldEditor>
    )

};