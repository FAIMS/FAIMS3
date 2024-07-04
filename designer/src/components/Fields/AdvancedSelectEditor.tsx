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

import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

import { Button, Alert, AlertTitle, TextField, Grid, Card, FormControl, FormLabel, FormControlLabel, RadioGroup, Radio, Collapse } from '@mui/material';

import { BaseFieldEditor } from "./BaseFieldEditor";
import { useAppSelector, useAppDispatch } from "../../state/hooks";
import { FieldType, Notebook } from "../../state/initial";

import { useState } from 'react';


type OptionTreeType = {
    name: string,
    type?: "" | "image",
    label?: string,
    children?: OptionTreeType[],
};

type newState = {
    optionTree: OptionTreeType,
    valueType: string,
}

export const AdvancedSelectEditor = ({ fieldName }: { fieldName: string }) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const dispatch = useAppDispatch();

    const state = {
        optionTree: field['component-parameters'].ElementProps?.optiontree as OptionTreeType,
        valueType: field['component-parameters'].valuetype || 'full',
    }

    const [newOptionTree, setNewOptionTree] = useState(JSON.stringify(state.optionTree, null, 2));
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [open, setOpen] = useState(false);

    const updateFieldFromState = (newState: newState) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
        newField['component-parameters'].valuetype = newState.valueType;

        if (newField['component-parameters'].ElementProps) {
            newField['component-parameters'].ElementProps.optiontree = newState.optionTree;
        }

        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } });
    }

    const updateProperty = (prop: string, value: string | OptionTreeType[]) => {
        const newState = { ...state, [prop]: value };
        updateFieldFromState(newState);
    }

    const isTypeMatch = (o: OptionTreeType[]) => {
        return o.forEach((opt: OptionTreeType) => {
            const validKeys: string[] = ["name", "type", "label", "children"]

            if (!Object.keys(opt).every(key => validKeys.includes(key))) {
                throw new Error(`Invalid property. Only 'name', 'type', 'label' and 'children' properties are accepted.`);
            }
            else if (!opt.name) {
                throw new Error('Missing property: name. Please refer to the example and try again.');
            }
            else if (opt.name && (typeof opt.name != "string")) {
                throw new Error(`Invalid 'name' property. The 'name' property must be a string. Please refer to the example and try again.`);
            }
            else if (opt.type && (opt.type.trim().length !== 0 && opt.type !== "image")) {
                throw new Error(`Invalid 'type' property at level ${opt.name}. The 'type' property must be an empty string ("") or "image". Please refer to the example and try again.`);
            }
            else if (opt.label && (typeof opt.label != "string")) {
                throw new Error(`Invalid 'label' property at level ${opt.name}. The 'label' property must be a string. Please refer to the example and try again.`);
            }
            else if (!opt.children) {
                throw new Error(`Missing property: children at level ${opt.name}. Please refer to the example and try again.`);
            }
            else if (opt.children) {
                // run validation check on the properties in children recursively
                isTypeMatch(opt.children);
            }
            else {
                // all good
                setErrorMessage('');
                return;
            }
        });
    }

    const validateOptionTree = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        let optionTree: OptionTreeType[];
        // catch SyntaxErrors
        try {
            JSON.parse(newOptionTree);
        }
        catch (error: unknown) {
            error instanceof SyntaxError && setErrorMessage(error.message);
        }

        // catch other errors
        try {
            optionTree = JSON.parse(newOptionTree) as OptionTreeType[];
            isTypeMatch(optionTree);
            updateProperty('optionTree', optionTree);
            setErrorMessage('');
            setSuccessMessage(`Saved successfully.`);
        }
        catch (error: unknown) {
            if (error instanceof Error) {
                setErrorMessage(error.message);
                setSuccessMessage('');
            }
        }
    }

    return (
        <BaseFieldEditor fieldName={fieldName}>
            <Grid item xs={12} sm={9}>
                <Card variant='outlined'>
                    <Grid item xs={12} sx={{ mx: 1.5, my: 2 }}>
                        <Grid container item xs={12} direction='column' alignItems='center'>
                            <Alert severity='info' sx={{ mb: 2 }}>
                                <AlertTitle>
                                    Example Structure
                                </AlertTitle>

                                <p>The following is an example of a valid JSON structure 
                                with 2 levels. The first level goes 1 level deep 
                                (i.e., stops at Level 1), the second goes 2 levels 
                                deep (i.e., includes Level 2 and Level 2.1).</p>
                                
                                <p>The properties <code>name</code> and <code>children</code> must be included, 
                                whereas the properties <code>type</code> and <code>label</code> are 
                                optional.</p>

                                <Button
                                    onClick={() => setOpen(!open)}
                                    size='small'
                                    color='info'
                                    endIcon={open ? <ExpandLess fontSize='small' /> : <ExpandMore fontSize='small' />}
                                >
                                    {open ? "Close" : "Show Help"}
                                </Button>

                                <Collapse in={open} unmountOnExit>
                                    <pre>
                                        {JSON.stringify([
                                                            {
                                                                name: "Level 1",
                                                                label: "example",
                                                                type: "image",
                                                                children: []
                                                            },
                                                            {
                                                                name: "Level 2",
                                                                children: [
                                                                {
                                                                    name: "Level 2.1",
                                                                    children: []
                                                                }
                                                                ]
                                                            }
                                                        ], null, 2)}
                                    </pre>
                                </Collapse>
                            </Alert>

                            <form onSubmit={validateOptionTree}>
                                <TextField
                                    InputProps={{ style: { fontFamily: 'monospace', fontSize: 14 } }}
                                    InputLabelProps={{ style: { fontSize: 14 } }}
                                    label="JSON"
                                    helperText="Use this field to type a JSON structure for your optiontree. Click 'Save' or press 'Enter' when done."
                                    value={newOptionTree}
                                    multiline
                                    fullWidth
                                    onChange={(e) => {
                                        setNewOptionTree(e.target.value)
                                        setSuccessMessage('')
                                        setErrorMessage('')
                                    }}
                                />

                                <Button
                                    sx={{ mt: 2.5 }}
                                    variant="contained"
                                    color="primary"
                                    type="submit"
                                >
                                    Save
                                </Button>

                                {errorMessage && <Alert severity="error" sx={{ mt: 2.5 }}>{errorMessage}</Alert>}

                                {successMessage && <Alert severity="success" sx={{ mt: 2.5 }}>{successMessage}</Alert>}
                            </form>
                        </Grid>
                    </Grid>
                </Card>
            </Grid>

            <Grid item xs={12} sm={3}>
                <Card variant='outlined'>
                    <Grid item xs={12} sx={{ mx: 1.5, my: 2 }}>
                        <FormControl>
                            <FormLabel id="value-type">Value Type</FormLabel>
                            <RadioGroup
                                aria-labelledby="value-type"
                                value={state.valueType}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProperty('valueType', e.target.value)}
                            >
                                <FormControlLabel value="full" control={<Radio />} label="Full" />
                                <FormControlLabel value="child" control={<Radio />} label="Child" />
                            </RadioGroup>
                        </FormControl>
                    </Grid>
                </Card>
            </Grid>
        </BaseFieldEditor>
    );
}