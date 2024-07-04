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

import { Grid, Card, FormHelperText, FormControlLabel, Checkbox } from "@mui/material";
import { useAppSelector, useAppDispatch } from "../../state/hooks";
import { BaseFieldEditor } from "./BaseFieldEditor";
import { FieldType, Notebook } from "../../state/initial";

export const DateTimeNowEditor = ({ fieldName }: {fieldName: string}) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const dispatch = useAppDispatch();

    const updateIsAutoPick = (value: boolean) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType;
        newField['component-parameters'].is_auto_pick = value;
        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } })
    }

    return (
        <BaseFieldEditor fieldName={fieldName}>
            <Grid item sm={6} xs={12}>
                <Card variant="outlined" sx={{ display: 'flex' }}>
                    <Grid item xs={12} sx={{ mx: 1.5, my: 2 }}>
                        <FormControlLabel
                            required
                            control={
                                <Checkbox
                                    checked={field['component-parameters'].is_auto_pick}
                                    onChange={(e) => { updateIsAutoPick(e.target.checked) }}
                                />
                            }
                            label="Time pre-populated"
                        />
                        <FormHelperText>
                            When the record is first created, populate this field with the current datetime.
                        </FormHelperText>
                    </Grid>
                </Card>
            </Grid>
        </BaseFieldEditor>
    )

};