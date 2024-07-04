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

import { ConditionType } from "../components/condition";


export type NotebookMetadata = PropertyMap;

export type PropertyMap = {
    [key: string]: unknown 
};

export type ComponentParameters = {
    fullWidth?: boolean,
    name?: string,
    id?: string,
    helperText?: string,
    variant?: string,
    label?: string,
    multiline?: boolean,
    multiple?: boolean,
    SelectProps?: unknown,
    ElementProps?: { 
        options?: {
            value: string, 
            label: string, 
            RadioProps?: unknown,
        }[],
        optiontree?: unknown,
    },
    InputLabelProps?: {label: string},
    InputProps?: {rows?: number, type?: string},
    FormLabelProps?: {children?: string},
    FormHelperTextProps?: {children?: string},
    FormControlLabelProps?: {label: string},
    initialValue?: unknown,
    related_type?: string,
    relation_type?: string,
    related_type_label?: string,
    relation_linked_vocabPair?: [string, string][],
    required?: boolean,
    template?: string,
    num_digits?: number,
    form_id?: string,
    is_auto_pick?: boolean,
    zoom?: number,
    featureType?: string,
    variant_style?: string,
    html_tag?: string,
    content?: string,
    hrid?: boolean,
    select?: boolean,
    geoTiff?: string,
    type?: string,
    valuetype?: string,
};

export type ValidationSchemaElement =  (string | number)[];

export type FieldType = {
    "component-namespace": string,
    "component-name": string,
    "type-returned": string,
    "component-parameters": ComponentParameters,
    "validationSchema"?: ValidationSchemaElement[],
    "initialValue"?: unknown,
    "access"?: string[],
    "condition"?: ConditionType | null,
    "persistent"?: boolean,
    "displayParent"?: boolean,
    "meta"?: {
        "annotation_label": string,
        "annotation": boolean,
        "uncertainty": {
            "include" : boolean,
            "label": string,
        }
    }
}; 

export type NotebookUISpec = {
    fields: {[key: string]: FieldType},
    fviews: {[key: string]: {
        "fields": string[],
        "uidesign"?: string,
        "label": string,
        "condition"?: ConditionType,
    }},
    viewsets: {[key: string]: {
        "views": string[],
        "label": string
    }},
    visible_types: string[],
}

export type Notebook = {
    metadata: NotebookMetadata,
    "ui-specification": NotebookUISpec
}

// an empty notebook
export const initialState: Notebook = {
    "metadata": {
        "notebook_version": "1.0",
        "schema_version": "1.0",
        "name": "",
        "accesses": ["admin", "moderator", "team"],
        "filenames": [],
        "ispublic": false,
        "isrequest": false,
        "lead_institution": "",
        "showQRCodeButton": false,
        "pre_description": "",
        "project_lead": "",
        "project_status": "New",
        "sections": {}
    },
    "ui-specification": {
        "fields":{},
        "fviews": {},
        "viewsets": {},
        "visible_types": []
    }
}