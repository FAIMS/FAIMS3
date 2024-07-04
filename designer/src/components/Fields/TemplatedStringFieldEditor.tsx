import { Alert, Grid, Card, TextField, FormControl, InputLabel, MenuItem, Select, FormControlLabel, Checkbox, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import { MutableRefObject, useRef, useState } from "react";
import { ComponentParameters, FieldType, Notebook } from "../../state/initial";

type PropType = {
    fieldName: string,
    viewId: string
};

export const TemplatedStringFieldEditor = ({ fieldName, viewId }: PropType) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const formHasHRID = useAppSelector((state: Notebook) => {
        return Object.keys(state['ui-specification'].fields).some((fieldName) => {
            return fieldName.startsWith('hrid') && fieldName.endsWith(viewId);
        });
    });
    const allFields = useAppSelector((state: Notebook) => state['ui-specification'].fields);
    const dispatch = useAppDispatch();
    const textAreaRef = useRef(null) as MutableRefObject<unknown>;

    const [alertMessage, setAlertMessage] = useState('');

    const state = field['component-parameters'];

    const isHRID = () => {
        return fieldName.startsWith('hrid') && fieldName.endsWith(viewId);
    };

    const getFieldLabel = (f: FieldType) => {
        return (f['component-parameters'].InputLabelProps && 
                  f['component-parameters'].InputLabelProps.label) ||
                f['component-parameters'].name;
    };

    const updateFieldFromState = (newState: ComponentParameters) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
        newField['component-parameters'].InputLabelProps = {label: newState.label || fieldName};
        newField['component-parameters'].helperText = newState.helperText;
        newField['component-parameters'].template = newState.template;
        newField['component-parameters'].hrid = newState.hrid;
        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } });
    };

    const setHRID = (newState: boolean) => {
        let newFieldName = state.InputLabelProps ? state.InputLabelProps.label : fieldName;
        if (newState) {
            // need to check whether there is already an HRID field in this form
            // if so we show an alert
            if (formHasHRID) {
                setAlertMessage('There is already an HRID field in this form.  You can only have one HRID field per form.');
                return;
            } else {
                newFieldName = 'hrid' + viewId;
            }
        }
        dispatch({type: 'ui-specification/fieldRenamed', payload: {viewId, fieldName, newFieldName}})
    };

    const updateProperty = (prop: string, value: string) => {
        const newState = { ...state, [prop]: value };
        updateFieldFromState(newState);
    };

    const insertFieldId = (fieldId: string) => {
        // insert {{fieldId}} at the cursor in the text area
        if (textAreaRef.current) {
            const el = textAreaRef.current as HTMLTextAreaElement;
            el.focus();
            const [start, end] = [el.selectionStart, el.selectionEnd];
            el.setRangeText(`{{${fieldId}}}`, start, end, 'select'); 
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    return (
        <Grid container spacing={2}>
            <Grid item xs={12}>
               { alertMessage && <Alert onClose={() => {setAlertMessage('')}} severity="error">{alertMessage}</Alert> }
                <Card variant="outlined" sx={{ display: 'flex' }}>
                    <Grid item sm={6} xs={12} sx={{ mx: 1.5, my: 2 }}>
                        <TextField
                            name="label"
                            variant="outlined"
                            label="Label"
                            value={state.label}
                            onChange={(e) => updateProperty('label', e.target.value)}
                            helperText="Enter a label for the field."
                        />
                    </Grid>
                    <Grid item sm={6} xs={12} sx={{ mx: 1.5, my: 2 }}>
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
                    <Grid item sm={6} xs={12} sx={{ mx: 1.5, my: 2 }}>
                        <FormControlLabel required
                                control={<Checkbox
                                    checked={isHRID()}
                                    onChange={(e) => setHRID(e.target.checked)}
                                />} label="Use as Human Readable ID" />

                        <Typography variant="body2" color="text.secondary">
                            HRID is the primary identifier for the record.
                        </Typography>
                    </Grid>
                </Card>

                <Grid item xs={12}>
                    <p>The template can contain any text plus references to field or metadata
                        values in double curly braces (e.g. {"{{field-id}}"}).  Use the menu 
                        on the right to insert the identifiers of the fields in this notebook.
                    </p>
                    <Card variant="outlined" sx={{ display: 'flex' }}>
                        <Grid item sm={6} xs={12} sx={{ mx: 1.5, my: 2 }}>
                            <TextField
                                name="template"
                                inputRef={(ref: MutableRefObject<HTMLElement>) => textAreaRef.current = ref}
                                variant="outlined"
                                fullWidth
                                multiline
                                rows={2}
                                label="Template"
                                value={state.template}
                                onChange={(e) => updateProperty('template', e.target.value)}
                                helperText="Enter the template."
                            />
                        </Grid>

                        <Grid item xs={4} sx={{ mx: 1.5, my: 2 }}>
                            <FormControl sx={{ minWidth: 200 }}>
                                <InputLabel id="featureType-label">Insert Field Identifier</InputLabel>
                                <Select
                                    labelId="featureType-label"
                                    label="Insert Field Identifier"
                                    onChange={(e) => insertFieldId(e.target.value)}
                                    value={''}
                                >
                                    {Object.keys(allFields).map((fieldId) => {
                                        return (
                                            <MenuItem key={fieldId} value={fieldId}>
                                                {getFieldLabel(allFields[fieldId])}
                                            </MenuItem>
                                        );
                                    })
                                    }
                                </Select>
                            </FormControl>
                    </Grid>
                    </Card>
                </Grid>
            </Grid>
        </Grid>
    )
};