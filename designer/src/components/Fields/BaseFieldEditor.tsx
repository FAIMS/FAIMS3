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

import { Checkbox, FormControlLabel, Grid, TextField, Card, Alert } from "@mui/material";
import { useAppSelector, useAppDispatch } from "../../state/hooks";
import { FieldType, Notebook } from "../../state/initial";
import { ConditionModal, ConditionTranslation, ConditionType } from "../condition";

type Props = {
    fieldName: string,
    children?: React.ReactNode
}

// gets rid of the type error in updateFieldFromState func
type StateType = {
    label?: string,
    helperText: string,
    required: boolean,
    persistent: boolean,
    displayParent: boolean,
    annotation: boolean,
    annotationLabel: string,
    uncertainty: boolean,
    uncertaintyLabel: string,
    condition?: ConditionType | null,
}

export const BaseFieldEditor = ({ fieldName, children }: Props) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const dispatch = useAppDispatch();

    // These are needed because there is no consistency in how
    // the field label is stored in the notebook
    const getFieldLabel = () => {
        return (field['component-parameters'] && field['component-parameters'].label) ||
            (field['component-parameters'].InputLabelProps && field['component-parameters'].InputLabelProps.label) ||
            field['component-parameters'].name;
    }

    const setFieldLabel = (newField: FieldType, label: string) => {
        console.log('setFieldLabel', newField, label);
        if (newField['component-parameters'] && 'label' in newField['component-parameters'])
            newField['component-parameters'].label = label;
        else if (newField['component-parameters'] &&
            'InputLabelProps' in newField['component-parameters'] &&
            newField['component-parameters'].InputLabelProps &&
            newField['component-parameters'].InputLabelProps.label)
            newField['component-parameters'].InputLabelProps.label = label;
    }

    const updateField = (fieldName: string, newField: FieldType) => {
        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } })
    }

    const cParams = field['component-parameters'];

    const state = {
        label: getFieldLabel(),
        helperText: cParams.helperText || "",
        required: cParams.required || false,
        annotation: field.meta ? field.meta.annotation || false : false,
        annotationLabel: field.meta ? field.meta.annotation_label || '' : '',
        uncertainty: field.meta ? field.meta.uncertainty.include || false : false,
        uncertaintyLabel: field.meta ? field.meta.uncertainty.label || '' : '',
        condition: field.condition,
        persistent: field.persistent || false,
        displayParent: field.displayParent || false,
    };

    const updateFieldFromState = (newState: StateType) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
        if (newState.label)
            setFieldLabel(newField, newState.label);
        newField['component-parameters'].helperText = newState.helperText;
        newField['component-parameters'].required = newState.required;
        if (newField.meta) {
            newField.meta.annotation = newState.annotation;
            newField.meta.annotation_label = newState.annotationLabel || '';
            newField.meta.uncertainty = {
                include: newState.uncertainty,
                label: newState.uncertaintyLabel || ''
            }
        }
        if (newState.condition) 
            newField.condition = newState.condition;
        else
            newField.condition = null;

        if (newState.persistent) 
            newField.persistent = newState.persistent;
        else
            newField.persistent = false;

        if (newState.displayParent) 
            newField.displayParent = newState.displayParent;
        else
            newField.displayParent = false;        
        
        updateField(fieldName, newField);
    };

    const updateProperty = (prop: string, value: string | boolean) => {
        const newState: StateType = { ...state, [prop]: value };
        updateFieldFromState(newState);
    };

    const conditionChanged = (condition: ConditionType | null) => {
        console.log('Field Condition Changed', condition);
        if (condition) {
            const newState: StateType = { ...state, condition: condition};
            updateFieldFromState(newState);
        } else {
            const newState: StateType = { ...state, condition: null};
            updateFieldFromState(newState);
        }
    }

    return (
        <Grid container spacing={2}>
            <Grid item xs={12}>
                <Card variant="outlined">
                    <Grid container p={2} rowSpacing={3}>
                        <Grid item sm={6} xs={12} >
                            <TextField
                                name="label"
                                variant="outlined"
                                label="Label"
                                value={state.label}
                                onChange={(e) => updateProperty('label', e.target.value)}
                                helperText="Enter a label for the field."
                            />
                        </Grid>

                        <Grid item sm={6} xs={12} >
                            <TextField
                                name="helperText"
                                variant="outlined"
                                label="Helper Text"
                                fullWidth
                                multiline={true}
                                rows={4}
                                value={state.helperText}
                                helperText="Help text shown along with the field (like this text)."
                                onChange={(e) => updateProperty('helperText', e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </Card>
            </Grid>

            {children}

            <Grid item xs={12}>
                <Card variant="outlined">
                    <Grid container p={2} columnSpacing={1} rowSpacing={1}>
                        <Grid item xs={12} sm={3}>
                            <FormControlLabel required
                                control={<Checkbox
                                    checked={state.required}
                                    onChange={(e) => updateProperty('required', e.target.checked)}
                                />} label="Required" />
                        </Grid>

                        <Grid item xs={12} sm={3} container direction="column" pr={1}>
                            <FormControlLabel required
                                control={<Checkbox
                                    checked={state.annotation}
                                    onChange={(e) => updateProperty('annotation', e.target.checked)}
                                />} label="Enable Annotation" />

                            {state.annotation &&
                                <TextField
                                    name="label"
                                    variant="outlined"
                                    label="Label"
                                    value={state.annotationLabel}
                                    onChange={(e) => updateProperty('annotationLabel', e.target.value)}
                                    helperText="Enter a label."
                                    sx={{ mt: 1.5 }}
                                />
                            }
                        </Grid>

                        <Grid item xs={12} sm={3} container direction="column">
                            <FormControlLabel required
                                control={<Checkbox
                                    checked={state.uncertainty}
                                    onChange={(e) => updateProperty('uncertainty', e.target.checked)}
                                />} label="Enable Uncertainty" />

                            {state.uncertainty &&
                                <TextField
                                    name="label"
                                    variant="outlined"
                                    label="Label"
                                    value={state.uncertaintyLabel}
                                    onChange={(e) => updateProperty('uncertaintyLabel', e.target.value)}
                                    helperText="Enter a label."
                                    sx={{ mt: 1.5 }}
                                />
                            }
                        </Grid>


                        <Grid item xs={12} sm={3}>
                            <ConditionModal 
                                label={state.condition ? "Update Condition" : "Add Condition"}
                                initial={state.condition} 
                                onChange={conditionChanged}
                                field={fieldName}/>
                        </Grid>
                
                    </Grid>

            <Grid>
                {state.condition ? 
                        (<Alert severity="info"><strong>Field Condition:</strong> Show this field if&nbsp;
                            <ConditionTranslation condition={state.condition}/></Alert>)
                        : (<></>)}
            </Grid>

            <Grid container p={2} columnSpacing={1} rowSpacing={1}>
                <Grid item xs={12} sm={6}>
                    <FormControlLabel
                        control={
                        <Checkbox
                            checked={state.persistent}
                            onChange={(e) =>
                            updateProperty("persistent", e.target.checked)
                            }
                        />
                        }
                        label="Copy this field value to new records of this type"
                    />
                </Grid> 
                <Grid item xs={12} sm={6}>
                    <FormControlLabel
                        control={
                        <Checkbox
                            checked={state.displayParent}
                            onChange={(e) =>
                            updateProperty("displayParent", e.target.checked)
                            }
                        />
                        }
                        label="Display this field in any parent record"
                    />
                </Grid>  
            </Grid>
                </Card>

            </Grid>
                  
        </Grid>
    )
};