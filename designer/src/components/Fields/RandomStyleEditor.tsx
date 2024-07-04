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

import { Grid, TextField, Card, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { useAppSelector, useAppDispatch } from "../../state/hooks";
import { BaseFieldEditor } from "./BaseFieldEditor";
import { Notebook, FieldType } from "../../state/initial";

export const RandomStyleEditor = ({ fieldName }: { fieldName: string }) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const dispatch = useAppDispatch();

    const initVariantStyle = field['component-parameters'].variant_style || '';
    const initHtmlTag = field['component-parameters'].html_tag;

    const updateField = (fieldName: string, newField: FieldType) => {
        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } });
    };

    const state = {
        variantStyle: field['component-parameters'].variant_style || "",
        htmlTag: field['component-parameters'].html_tag || ""
    };

    type newState = {
        variantStyle: string,
        htmlTag: string,
    };

    const updateFieldFromState = (newState: newState) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
        newField['component-parameters'].variant_style = newState.variantStyle;
        newField['component-parameters'].html_tag = newState.htmlTag;
        updateField(fieldName, newField);
    };

    const updateProperty = (prop: string, value: string) => {
        const newState = { ...state, [prop]: value };
        updateFieldFromState(newState);
    };

    return (
        <BaseFieldEditor fieldName={fieldName}>
            <Grid item xs={12}>
                <Card variant="outlined">
                    <Grid container p={2} rowSpacing={3}>
                        <Grid item sm={6} xs={12}>
                            <FormControl>
                                <InputLabel id="featureType-label">Select Style</InputLabel>
                                <Select
                                    labelId="featureType-label"
                                    label="Select Style"
                                    value={initVariantStyle}
                                    onChange={(e) => updateProperty('variantStyle', e.target.value)}
                                >
                                    <MenuItem value="h1">Title 1</MenuItem>
                                    <MenuItem value="h2">Title 2</MenuItem>
                                    <MenuItem value="h3">Title 3</MenuItem>
                                    <MenuItem value="h4">Title 4</MenuItem>
                                    <MenuItem value="h5">Title 5</MenuItem>
                                    <MenuItem value="subtitle1">Subtitle 1</MenuItem>
                                    <MenuItem value="subtitle2">Subtitle 2</MenuItem>
                                    <MenuItem value="body1">Body 1</MenuItem>
                                    <MenuItem value="body2">Body 2</MenuItem>
                                    <MenuItem value="caption">Caption Text</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item sm={6} xs={12}>
                            <TextField
                                variant="outlined"
                                label="html_tag"
                                type="text"
                                value={initHtmlTag}
                                multiline
                                fullWidth
                                rows={5}
                                helperText="If you want html tag ONLY, leave the label empty and input the html tag."
                                onChange={(e) => updateProperty('htmlTag', e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </Card>
            </Grid>
        </BaseFieldEditor>
    )
};