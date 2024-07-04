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

import { Grid, Card, TextField } from "@mui/material";
import { useAppSelector, useAppDispatch } from "../../state/hooks";
import { BaseFieldEditor } from "./BaseFieldEditor";
import { FieldType, Notebook } from "../../state/initial";

export const MultipleTextFieldEditor = ({ fieldName }: { fieldName: string }) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const dispatch = useAppDispatch();

    const rows = field['component-parameters'].InputProps?.rows || 4;

    const updateRows = (value: number) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
        newField['component-parameters'].InputProps = {rows: value};
        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } })
    }

    return (
        <BaseFieldEditor fieldName={fieldName}>
            <Grid item sm={6} xs={12}>
                <Card variant="outlined" sx={{ display: 'flex' }}>
                    <Grid item xs={12} sx={{ mx: 1.5, my: 2 }}>
                        <TextField
                            name="rows"
                            variant="outlined"
                            label="Rows to display"
                            type="number"
                            value={rows}
                            helperText="Number of rows in the text field."
                            onChange={(e) => updateRows(parseInt(e.target.value))}
                        />
                    </Grid>
                </Card>
            </Grid>
        </BaseFieldEditor>
    )
    
};