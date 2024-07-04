import { Grid, Card, TextField } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import { FieldType, Notebook } from "../../state/initial";

type PropType = {
    fieldName: string,
    viewId: string
};

export const BasicAutoIncrementerEditor = ({ fieldName, viewId }: PropType) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const dispatch = useAppDispatch();

    const label = field['component-parameters'].label;
    const digits = field['component-parameters'].num_digits || 4;

    const updateDigits = (value: number) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
        // ensure that the form_id in the field is set correctly
        newField['component-parameters'].form_id = viewId;
        newField['component-parameters'].num_digits = value;
        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } })
    }
    const updateLabel = (value: string) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
        // ensure that the form_id in the field is set correctly
        newField['component-parameters'].form_id = viewId;
        newField['component-parameters'].label = value;
        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } })
    }

    return (
            <Grid item sm={6} xs={12}>
                <Card variant="outlined" sx={{ display: 'flex' }}>
                <Grid item xs={12} sx={{ mx: 1.5, my: 2 }}>
                        <TextField
                            name="label"
                            variant="outlined"
                            label="Label"
                            fullWidth
                            value={label}
                            onChange={(e) => updateLabel(e.target.value)}
                            helperText="Enter a label for the field."
                        />
                    </Grid>
                </Card>
                <Card variant="outlined" sx={{ display: 'flex' }}>
                    <Grid item xs={12} sx={{ mx: 1.5, my: 2 }}>
                        <TextField
                            name="digits"
                            variant="outlined"
                            label="Number of digits in identifier"
                            type="number"
                            value={digits}
                            helperText="Identifier will be padded with zeros up to this many digits."
                            onChange={(e) => updateDigits(parseInt(e.target.value))}
                        />
                    </Grid>
                </Card>
            </Grid>
                )
    
};