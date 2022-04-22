/*
 * Copyright 2021, 2022 Macquarie University
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
import {isEqual} from 'lodash';

import {FAIMSTypeName} from './core';
import {AttributeValuePair, FAIMSAttachment} from './database';

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

export interface ProjectUIFields {
  [key: string]: any;
}

export interface ProjectUIViewsets {
  [type: string]: {
    label?: string;
    views: string[];
    submit_label?: string;
    is_visible?: boolean;
  };
}

export interface ProjectUIViews {
  [key: string]: {
    label?: string;
    fields: string[];
    uidesign?: string;
    next_label?: string;
  };
}

export interface option {
  value: string;
  label: string;
  key?: string;
}

type AttributeValuePairDumper = (
  avp: AttributeValuePair
) => Array<AttributeValuePair | FAIMSAttachment>;

type AttributeValuePairLoader = (
  avp: AttributeValuePair,
  attach_docs: FAIMSAttachment[]
) => AttributeValuePair;

type EqualityForFAIMSTypeFunction = (first: any, second: any) => boolean;

const attachment_dumpers: {
  [typename: string]: AttributeValuePairDumper;
} = {};
const attachment_loaders: {
  [typename: string]: AttributeValuePairLoader;
} = {};
const equality_functions: {
  [typename: string]: EqualityForFAIMSTypeFunction;
} = {};

export function getAttachmentLoaderForType(
  type: FAIMSTypeName
): AttributeValuePairLoader | null {
  const loader = attachment_loaders[type];
  if (loader === null || loader === undefined) {
    return null;
  }
  return loader;
}

export function getAttachmentDumperForType(
  type: FAIMSTypeName
): AttributeValuePairDumper | null {
  const dumper = attachment_dumpers[type];
  if (dumper === null || dumper === undefined) {
    return null;
  }
  return dumper;
}

export function setAttachmentLoaderForType(
  type: FAIMSTypeName,
  loader: AttributeValuePairLoader
) {
  attachment_loaders[type] = loader;
}

export function setAttachmentDumperForType(
  type: FAIMSTypeName,
  dumper: AttributeValuePairDumper
) {
  attachment_dumpers[type] = dumper;
}

export function getEqualityFunctionForType(
  type: FAIMSTypeName
): EqualityForFAIMSTypeFunction {
  const loader = equality_functions[type];
  if (loader === null || loader === undefined) {
    return isEqual;
  }
  return loader;
}

export function setEqualityFunctionForType(
  type: FAIMSTypeName,
  loader: EqualityForFAIMSTypeFunction
) {
  equality_functions[type] = loader;
}
