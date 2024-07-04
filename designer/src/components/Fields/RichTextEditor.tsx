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

import { Grid, FormHelperText } from "@mui/material";
import { useAppSelector, useAppDispatch } from "../../state/hooks";
import { useRef } from "react";
import { MDXEditorMethods } from '@mdxeditor/editor';
import { FieldType, Notebook } from "../../state/initial";
import { MdxEditor } from "../mdx-editor";


export const RichTextEditor = ({ fieldName }: { fieldName: string }) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const dispatch = useAppDispatch();

    const initContent = field['component-parameters'].content || "";
    const ref = useRef<MDXEditorMethods>(null);

    const updateField = (fieldName: string, newField: FieldType) => {
        dispatch({ type: 'ui-specification/fieldUpdated', payload: { fieldName, newField } })
    }

    const state = {
        content: field['component-parameters'].content || "",
    };

    type newState = {
        content: string,
    }

    const updateFieldFromState = (newState: newState) => {
        const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
        newField['component-parameters'].content = newState.content;
        updateField(fieldName, newField);
    };

    const updateProperty = (prop: string, value: string | undefined) => {
        const newState = { ...state, [prop]: value };
        updateFieldFromState(newState);
    };


    return (
        <Grid container item xs={12} sm={8} sx={{ m: 'auto' }}>
            <Grid item xs={12}>
                <MdxEditor
                    initialMarkdown={initContent}
                    editorRef={ref}
                    handleChange={() => updateProperty('content', ref.current?.getMarkdown())} 
                />
                <FormHelperText>Use this editor to add rich text to your notebook.</FormHelperText>
            </Grid>
        </Grid>
    )
};