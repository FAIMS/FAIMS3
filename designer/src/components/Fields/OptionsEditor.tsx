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

import { Grid, TextField, List, ListItem, ListItemText, Alert, Button, Card, IconButton } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';

import { BaseFieldEditor } from "./BaseFieldEditor"
import { useAppSelector, useAppDispatch } from "../../state/hooks";
import { useState } from "react";
import { FieldType, Notebook } from "../../state/initial";

export const OptionsEditor = ({ fieldName }: { fieldName: string }) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName])
    const dispatch = useAppDispatch()

    const [newOption, setNewOption] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    const getOptions = () => {
        let options;
        if (field['component-parameters'].ElementProps) {
            options = field['component-parameters'].ElementProps.options;
            if (options)
                options = options.map((pair) => pair.label.trim())
        } else {
            field['component-parameters'].ElementProps = { options: [] }
        }
        if (options)
            return options
        else
            return []
    }

    const options = getOptions()

    const updateOptions = (updatedOptions: string[]) => {
        // take a deep copy of the field
        const newField = JSON.parse(JSON.stringify(field)) as FieldType;
        newField['component-parameters'].ElementProps = {
            options: updatedOptions.map((o, index) => {
                if (fieldName.includes('radio')) {
                    return {
                        RadioProps: {
                            id: 'radio-group-field-' + index
                        },
                        label: o,
                        value: o,
                    }
                }
                else {
                    return {
                        label: o,
                        value: o
                    }
                }

            })
        };

        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } })
    }

    const addOption = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const emptyOption: boolean = newOption.trim().length == 0
        const duplicateOption: boolean = options.some((element: string) => {
            // Making sure duplicate check is case insensitive.
            // eg if the array has an element 'hi', then a user should not be able to add 'Hi' since that's a duplicate
            const lowerElement = element.toLowerCase()
            const lowerNewOption = newOption.toLowerCase()
            return lowerElement === lowerNewOption
        })

        if (emptyOption) {
            setErrorMessage('Cannot add an empty option!')
        }
        else if (duplicateOption) {
            setErrorMessage('This option already exists in the list.')
        }
        else {
            const newOptions = [...options, newOption]
            updateOptions(newOptions)
            setErrorMessage('')
        }
        setNewOption('')
    }

    const removeOption = (option: string) => {
        const newOptions = options.filter((o: string) => o !== option)
        updateOptions(newOptions)
    }

    return (
        <BaseFieldEditor fieldName={fieldName}>
            <Grid item xs={12}>
                <Card variant="outlined">
                    <Grid container p={2}>
                        <Grid item xs={12} sm={6}>
                            <Alert severity="info">Add and remove options as needed.</Alert>
                            <form onSubmit={addOption}>
                                <Grid item alignItems="stretch" style={{ display: "flex" }}>
                                    <TextField
                                        label="Add Option"
                                        value={newOption}
                                        onChange={(e) => setNewOption(e.target.value)}
                                        sx={{ my: 1.5 }} />
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
                                {options.map((option: string) => {
                                    return (
                                        <ListItem
                                            key={option}
                                            secondaryAction={
                                                <IconButton
                                                    edge="end"
                                                    aria-label="delete"
                                                    onClick={() => removeOption(option)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            }
                                        >
                                            <ListItemText primary={option} />
                                        </ListItem>
                                    )
                                })}
                            </List>
                        </Grid>
                    </Grid>
                </Card>
            </Grid>
        </BaseFieldEditor>
    )
}