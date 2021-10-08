/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: typesystem.ts
 * Description:
 *   TODO
 */

export type GroupName = string;
export type FieldComponentParameters = any;
export type ValidationSchema = any;

export interface FAIMSType {
  [key: string]: any; // any for now until we lock down the json
}

export interface FAIMSTypeCollection {
  [key: string]: FAIMSType;
}

export interface FAIMSConstant {
  [key: string]: any; // any for now until we lock down the json
}

export interface FAIMSConstantCollection {
  [key: string]: FAIMSConstant;
}

export interface ProjectUIViewset {
  label?: string;
  views: string[];
  submit_label?: string;
  editable_by?: GroupName[];
}

export interface ProjectUIView {
  label?: string;
  fields: string[];
  next_label?: string;
  editable_by?: GroupName[];
}

export interface ProjectUIField {
  component_namespace: string;
  component_name: string;
  type_returned: string;
  component_parameters: FieldComponentParameters;
  validationSchema: ValidationSchema;
  initialValue: any;
  editable_by?: GroupName[];
}

export interface ProjectUIFields {
  [key: string]: ProjectUIField;
}

export interface ProjectUIViewsets {
  [type: string]: ProjectUIViewset;
}

export interface ProjectUIViews {
  [key: string]: ProjectUIView;
}
