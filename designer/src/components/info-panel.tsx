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

import { Alert, Button, Checkbox, FormControlLabel, FormHelperText, Grid, TextField, Typography, Card } from "@mui/material";
import { useEffect, useState, useRef } from "react";
import { useAppSelector, useAppDispatch } from "../state/hooks";
import { Notebook, PropertyMap } from "../state/initial";
import { MdxEditor } from "./mdx-editor";
import { MDXEditorMethods } from '@mdxeditor/editor';


export const InfoPanel = () => {

    const metadata = useAppSelector((state: Notebook) => state.metadata);
    const dispatch = useAppDispatch();

    const ref = useRef<MDXEditorMethods>(null);

    const [metadataFieldName, setMetadataFieldName] = useState('');
    const [metadataFieldValue, setMetadataFieldValue] = useState('');
    const [extraFields, setExtraFields] = useState<PropertyMap>({});
    const [alert, setAlert] = useState('');

    useEffect(() => {
        const knownFields = ['name', 'pre_description', 'behaviours', 'meta',
            'project_lead', 'lead_institution', 'showQRCodeButton',
            'access', 'accesses', 'forms', 'filenames',
            'ispublic', 'isrequest', 'sections',
            'project_status', 'schema_version', 'notebook_version'];
        const unknownFields = Object.keys(metadata).filter((key) => !knownFields.includes(key));
        const newExtraFields: PropertyMap = {};
        unknownFields.forEach((key) => {
            newExtraFields[key] = metadata[key];
        });
        setExtraFields(newExtraFields);
    }, [metadata]);

    const setProp = (property: string, value: string) => {
        dispatch({ type: 'metadata/propertyUpdated', payload: { property, value } });
    };

    const updateMetadataFieldName = (event: React.ChangeEvent<HTMLInputElement>) => {
        setMetadataFieldName(event.target.value);
    };

    const updateMetadataFieldValue = (event: React.ChangeEvent<HTMLInputElement>) => {
        setMetadataFieldValue(event.target.value);
    };

    const addNewMetadataField = () => {
        setAlert('');
        if (metadataFieldName in metadata) {
            setAlert(`Field '${metadataFieldName}' already exists.`);
        } else {
            setMetadataFieldName('');
            setMetadataFieldValue('');
            setProp(metadataFieldName, metadataFieldValue);
        }
    };


    return (
        <div>
            <Typography variant="h2">General Information</Typography>
            <Card variant="outlined" sx={{ mt: 2 }}>
                <Grid container spacing={5} p={3}>
                    <Grid container item xs={12} spacing={2.5}>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                required
                                label="Project Name"
                                name="name"
                                data-testid="name"
                                value={metadata.name}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                    setProp('name', event.target.value);
                                }}
                            />
                            <FormHelperText>Enter a string between 2 and 100 characters long.</FormHelperText>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Project Lead"
                                name="project_lead"
                                value={metadata.project_lead}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                    setProp('project_lead', event.target.value);
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Lead Institution"
                                name="lead_institution"
                                value={metadata.lead_institution}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                    setProp('lead_institution', event.target.value);
                                }}
                            />
                        </Grid>
                    </Grid>

                    <Grid item xs={12}>
                        <MdxEditor
                            initialMarkdown={metadata.pre_description as string}
                            editorRef={ref}
                            handleChange={() => setProp('pre_description', ref.current?.getMarkdown() as string)}
                        />
                        <FormHelperText>
                            Use the editor above for the project description.
                            If you use source mode, make sure you put blank lines before and after any markdown syntax for compatibility.
                        </FormHelperText>
                    </Grid>

                    <Grid container item xs={12} spacing={2.5} justifyContent="space-between">
                        <Grid container item xs={12} sm={4} spacing={5}>
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={<Checkbox
                                        checked={metadata.showQRCodeButton === "true"}
                                        onChange={(e) => setProp('showQRCodeButton', e.target.checked ? "true" : "false")}
                                    />} label="Enable QR Code Search of Records" />
                                <FormHelperText>Useful if your form includes a QR code field.</FormHelperText>
                            </Grid>
                            <Grid item xs={12}>
                                <Grid item xs={12} sm={10}>
                                    <TextField
                                        fullWidth
                                        label="Notebook Version"
                                        name="notebook_version"
                                        value={metadata.notebook_version}
                                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                            setProp('notebook_version', event.target.value);
                                        }}
                                    />
                                    <FormHelperText>Use this field to differentiate between versions of this notebook; e.g. 1.0, 1.1 and so on.</FormHelperText>
                                </Grid>
                            </Grid>
                        </Grid>

                        <Grid item xs={12} sm={8}>
                            <Card variant="outlined">
                                <Grid container p={2.5} spacing={3}>
                                    <Grid
                                        container item xs={12} sm={5}
                                        direction="column"
                                        justifyContent="flex-start"
                                        alignItems="flex-start"
                                    >
                                        <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                                            e.preventDefault();
                                            addNewMetadataField();
                                        }}>
                                            <TextField
                                                fullWidth
                                                label="Metadata Field Name"
                                                name="metadata_field_name"
                                                size="small"
                                                value={metadataFieldName}
                                                onChange={updateMetadataFieldName}
                                            />
                                            <TextField
                                                fullWidth
                                                sx={{ mt: 1.5 }}
                                                label="Metadata Field Value"
                                                name="metadata_field_value"
                                                size="small"
                                                value={metadataFieldValue}
                                                onChange={updateMetadataFieldValue}
                                            />
                                            <Button
                                                sx={{ mt: 2.5 }}
                                                variant="contained"
                                                color="primary"
                                                type="submit"
                                            >
                                                Create New Field
                                            </Button>
                                            {alert &&
                                                <Alert onClose={() => { setAlert('') }} severity="error" sx={{ mt: 2.5 }}>{alert}</Alert>
                                            }
                                        </form>
                                    </Grid>

                                    <Grid container item xs={12} sm={7} rowGap={1}>
                                        {Object.keys(extraFields).map((key) => {
                                            return (
                                                <Grid item xs={12} key={key}>
                                                    <TextField
                                                        fullWidth
                                                        label={key}
                                                        name={key}
                                                        data-testid={'extra-field-' + key}
                                                        value={extraFields[key]}
                                                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                                            setProp(key, event.target.value);
                                                        }}
                                                    />
                                                </Grid>
                                            );
                                        })}
                                    </Grid>
                                </Grid>
                            </Card>
                            <FormHelperText>Use the form above to create new metadata fields, if needed.</FormHelperText>
                        </Grid>
                    </Grid>
                </Grid>
            </Card>
        </div>
    );
}