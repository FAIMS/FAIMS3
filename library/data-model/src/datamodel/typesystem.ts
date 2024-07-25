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
import {isEqual, isNull} from 'lodash';
import {logError} from '../logging';
import {AttributeValuePair, FAIMSAttachment} from '../types';

import {FAIMSTypeName} from '../types';

type AttributeValuePairDumper = (
  avp: AttributeValuePair
) => Array<AttributeValuePair | FAIMSAttachment>;

type AttributeValuePairLoader = (
  avp: AttributeValuePair,
  attach_docs: FAIMSAttachment[]
) => AttributeValuePair;

type EqualityForFAIMSTypeFunction = (
  first: any,
  second: any
) => Promise<boolean>;

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

// TODO: testing under node I get the error that Blob is not defined
//    so might need to modify this test to have it work on both
//    browser and node environments
//  use duck typing instead, blobs have 'size' and 'type' properties
function isAttachment(a: any): boolean {
  return !isNull(a) && a.size !== undefined && a.type !== undefined;
}

/*
 * This wraps the isEqual from lodash to add support for blobs which is needed
 * for attachments. It would be nice to replace this with a easier to use option
 * (e.g. without async), but this will have to do for now...
 */
export async function isEqualFAIMS(a: any, b: any): Promise<boolean> {
  if (Array.isArray(a) !== Array.isArray(b)) {
    // only one of a or b is an array, so not equal
    //console.debug('Not both arrays', a, b);
    return false;
  } else if (Array.isArray(a) && Array.isArray(b)) {
    //console.debug('Checking arrays', a, b);
    if (a.length !== b.length) {
      // console.debug('arrays different length', a, b);
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      const same = await isEqualFAIMS(a[i], b[i]);
      if (!same) {
        return false;
      }
    }
    return true;
  } else if (isAttachment(a) && isAttachment(b)) {
    // console.debug('Checking equality of blobs', a, b);
    if (a.size !== b.size || a.type !== b.type) {
      return false;
    }
    // console.debug('Checking equality of blob contents', a, b);
    return await Promise.all([a.arrayBuffer(), b.arrayBuffer()])
      .then((res: [any, any]) => {
        const buf_a = res[0] as ArrayBuffer;
        const buf_b = res[1] as ArrayBuffer;
        const arr_a = new Uint8Array(buf_a);
        const arr_b = new Uint8Array(buf_b);
        // console.info('Checking array buffers', arr_a, arr_b);
        return arr_a.every((element, index) => {
          return element === arr_b[index];
        });
      })
      .catch(err => {
        logError(err); // blob checking failed
        return false;
      });
  } else {
    // console.debug('Using lodash to check equality', a, b);
    return isEqual(a, b);
  }
}

export function getEqualityFunctionForType(
  type: FAIMSTypeName
): EqualityForFAIMSTypeFunction {
  const loader = equality_functions[type];
  if (loader === null || loader === undefined) {
    return isEqualFAIMS;
  }
  return loader;
}

export function setEqualityFunctionForType(
  type: FAIMSTypeName,
  loader: EqualityForFAIMSTypeFunction
) {
  equality_functions[type] = loader;
}
