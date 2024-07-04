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

import { Grid, Select, FormControl, InputLabel, MenuItem, Stack, Divider, TextField, Button, IconButton, Tooltip, Dialog } from "@mui/material";
import { useAppSelector } from "../state/hooks";
import { FieldType, Notebook } from "../state/initial";
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import SplitscreenIcon from '@mui/icons-material/Splitscreen';
import QuizIcon from '@mui/icons-material/Quiz';
import {useState, useMemo} from "react";

// Defines the Condition component to create a conditional expression
// that can be attached to a View or Field (and maybe more)

export type ConditionType = {
    operator: string;
    field?: string;
    value?: unknown;
    conditions?: ConditionType[];
}

type ConditionProps = {
    onChange?: ((v: ConditionType | null) => void);
    initial?: ConditionType | null;
    field?: string; // the field this condition will attach to
    view?: string; // the view this condition will attach to
}

const EMPTY_FIELD_CONDITION = {operator: 'equal', field: '', value: ''};
const EMPTY_BOOLEAN_CONDITION = {operator: 'and', conditions: []}

const allOperators = new Map([
    ['equal', 'Equal to'],
    ['not-equal', 'Not equal to'],
    ['greater', 'Greater than'],
    ['greater-equal', 'Greater than or equal'],
    ['less', 'Less than'],
    ['less-equal', 'Less than or equal'],
    ['regex', 'Matches regular expression'],
]);


const getFieldLabel = (f: FieldType) => {
    return (f['component-parameters'].InputLabelProps && 
            f['component-parameters'].InputLabelProps.label) ||
            f['component-parameters'].name;
};

export const ConditionModal = (props: ConditionProps & {label: string}) => {

    const [open, setOpen] = useState(false);
  
    return (
        <>
         <Button 
            onClick={() => setOpen(true)}
            size="small" 
            startIcon={<QuizIcon />} >{props.label}</Button>
         <Dialog 
            open={open}
            fullWidth={true}
            maxWidth="lg"
         >
            <ConditionControl 
                initial={props.initial} 
                onChange={props.onChange}
                field={props.field}
                view={props.view}/>

            <Button onClick={() => setOpen(false)}>Close</Button>
         </Dialog>
        </>
    )
}


export const ConditionTranslation = (props: {condition: ConditionType}) => {

    const allFields = useAppSelector((state: Notebook) => state['ui-specification'].fields);

    const getFieldName = (field: string | undefined) => {
        if (field !== undefined && field in allFields) 
            return getFieldLabel(allFields[field]);
        else 
            return field;
    }
    /**
     * Translate a condition into English for display
     * @param condition a condition object
     */
    const translateCondition = (condition: ConditionType) => {
        if (condition === undefined) 
            return 'empty condition';
        let result = '';
        if (condition.operator === 'and' || condition.operator === 'or') {
            if (condition.conditions) {
                const subTranslations = condition.conditions.map((cond) => {
                    return translateCondition(cond);
                });
                result = subTranslations.join(' ' + condition.operator + ' ');
            } else {
                result = 'empty condition'
            }
        } else {

            result = getFieldName(condition.field) + ' ' + 
            allOperators.get(condition.operator)?.toLowerCase() + ' ' + 
            (condition.value as string);
        }
        return result;
    }

    return (<span>{translateCondition(props.condition)}</span>)
}

export const ConditionControl = (props: ConditionProps) => {

    const initial = props.initial || EMPTY_FIELD_CONDITION;

    const [condition, setCondition] = useState<ConditionType | null>(initial);

    const conditionChanged = (condition: ConditionType | null) => {
        setCondition(condition);
        if (props.onChange !== undefined) props.onChange(condition);
    }

    if (condition === null) 
        return (<p>Empty Condition</p>);
    else {
        const isBoolean = condition.operator === 'and' || condition.operator === 'or';
        return (
            <Stack direction="row" spacing={2} sx={{border: '1px dashed grey', padding: '10px'}}>
                {isBoolean ?
                    (<BooleanConditionControl 
                        onChange={conditionChanged} 
                        initial={condition}
                        field={props.field}
                        view={props.view} />)
                    :
                    (<FieldConditionControl 
                        onChange={conditionChanged} 
                        initial={condition}
                        field={props.field}
                        view={props.view} />)
                }
            </Stack>
        )
    }

}

const BooleanConditionControl = (props: ConditionProps) => {

    const initial: ConditionType = useMemo(() => props.initial || EMPTY_BOOLEAN_CONDITION, [props]);

    const [condition, setCondition] = useState<ConditionType|null>(initial);

    const updateOperator = (value: string) => {
        updateCondition({...condition, operator: value})
    }

    const updateCondition = (condition: ConditionType | null) => {
        setCondition(condition);
        if (condition && props.onChange && 
            condition.operator && condition.conditions) {
            props.onChange(condition);
        }
    }

    // callback for each condition inside the boolean
    const conditionCallback = (index: number) => {
        return (value: ConditionType | null) => {
            if (condition && condition.conditions) {
                if (value === null) {
                    const newConditions = condition.conditions.filter((_v: ConditionType, i: number) => {
                        return (i !== index)
                    })
                    if (newConditions.length === 0) 
                        updateCondition(null);
                    else 
                        updateCondition({...condition, conditions: newConditions})
                } else {
                    const newConditions = condition.conditions.map((v: ConditionType, i: number) => {
                        if (i === index) return value;
                        else return v;
                    })
                    updateCondition({...condition, conditions: newConditions})
                }
            } else if (condition) {
                if (value) updateCondition({...condition, conditions: [value]})
                else updateCondition(null)
            }
        }
    }
    
    const addCondition = () => {
        if (condition) {
            const existing = condition.conditions || [];
            // construct a condition with an new empty field condition
            const newCondition = {...condition, 
                    conditions: [
                        ...existing, 
                        EMPTY_FIELD_CONDITION
                    ]
                };
            updateCondition(newCondition)
        }
    };

    const deleteCondition = () => {
        if (props.onChange) {
            props.onChange(null);
        }
    }

    if (condition) 
        return (
            <Stack direction='row' spacing={2}>

                <Stack direction="column" spacing={2}>
                        {condition.conditions ? 
                            condition.conditions.map((cond: ConditionType, index: number) => 
                            (
                                <ConditionControl 
                                    key={index} 
                                    onChange={conditionCallback(index)} 
                                    initial={cond}
                                    field={props.field}
                                    view={props.view}/>
                            ))
                            : (<div></div>)
                        }
                <Tooltip describeChild title="Add another condition">
                    <Button variant="outlined" color='primary' onClick={addCondition}>
                        Add another condition
                    </Button>
                </Tooltip>
                </Stack>
                <Stack direction="column" spacing={2}>
                    <FormControl sx={{ minWidth: 100 }}>
                        <InputLabel id="operator">Operator</InputLabel>
                        <Select
                            labelId="operator"
                            label="Operator"
                            onChange={(e) => updateOperator(e.target.value)}
                            value={condition.operator}
                        >
                            <MenuItem key="and" value="and">
                                and
                            </MenuItem>
                            <MenuItem key="or" value="or">
                                or
                            </MenuItem>
                        </Select>
                    </FormControl>

                    <Tooltip describeChild title="Remove this boolean condition">
                        <IconButton color='secondary' onClick={deleteCondition}>
                            <RemoveCircleIcon/>
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        );
        else return (<div></div>)

}

const FieldConditionControl = (props: ConditionProps) => {
    
    const initialValue = useMemo(() => props.initial || {
        field: '',
        operator: '',
        value: ''
    }, [props]);
    const [condition, setCondition] = useState(initialValue);

    const allFields = useAppSelector((state: Notebook) => state['ui-specification'].fields);
    const views = useAppSelector((state: Notebook) => state['ui-specification'].fviews);

    // work out which fields to show in the select, remove either 
    // the current field or the fields in the current view
    let selectFields = Object.keys(allFields);
    if (props.field) {
        selectFields = selectFields.filter(f => f !== props.field);
    } else if (props.view) {
        const view = views[props.view];
        selectFields = selectFields.filter(f => view.fields.indexOf(f) < 0)
    }

    const updateField = (value: string) => {
        updateCondition({...condition, field: value});
    }

    const updateOperator = (value: string) => {
        updateCondition({...condition, operator: value});
    }

    const updateValue = (value: unknown) => {
        updateCondition({...condition, value: value});
    }

    const updateCondition = (condition: ConditionType) => {
        setCondition(condition);
        if (props.onChange && condition.field && condition.operator && condition.value) {
            props.onChange(condition);
        }
    }

    const addCondition = () => {
        if (props.onChange) {
           props.onChange({
                operator: 'and',
                conditions: [condition, EMPTY_FIELD_CONDITION]
            })
        }
    }

    const deleteCondition = () => {
        if (props.onChange) {
            props.onChange(null);
         }
    }

    return (
        <Grid container>
            <Stack
              direction="row" 
              spacing={2} 
              divider={<Divider orientation="vertical" flexItem />}
              justifyContent="space-evenly"
            >
                <FormControl sx={{ minWidth: 200 }} data-testid="field-input">
                    <InputLabel id="field">Field</InputLabel>
                    <Select
                        labelId="field"
                        label="Field Name"
                        onChange={(e) => updateField(e.target.value)}
                        value={condition.field}
                    >
                        {selectFields.map((fieldId) => {
                            return (
                                <MenuItem key={fieldId} value={fieldId}>
                                    {getFieldLabel(allFields[fieldId])}
                                </MenuItem>
                            );
                        })
                        }
                    </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 200 }} data-testid="operator-input">
                    <InputLabel id="operator">Operator</InputLabel>
                    <Select
                        labelId="operator"
                        label="Operator"
                        onChange={(e) => updateOperator(e.target.value)}
                        value={condition.operator}
                    >
                    {[...allOperators.keys()].map((op: string) => {
                            return (
                                <MenuItem key={op} value={op}>
                                    {allOperators.get(op)}
                                </MenuItem>
                            );
                        })
                    }
                    </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 200 }} data-testid="value-input">
                    <TextField 
                      variant="outlined"
                      label="Value"
                      value={condition.value}
                      onChange={(e) => updateValue(e.target.value)} />
                </FormControl>
                <Tooltip describeChild title="Make this an 'and' or 'or' condition">
                    <IconButton color='primary' onClick={addCondition} data-testid="split-button">
                        <SplitscreenIcon/>
                    </IconButton>
                </Tooltip>
                <Tooltip describeChild title="Remove this condition">
                    <IconButton color='secondary' onClick={deleteCondition} data-testid="delete-button">
                        <RemoveCircleIcon/>
                    </IconButton>
                </Tooltip>
            </Stack>
        </Grid>
    )
}
