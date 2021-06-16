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
 * Filename: validationHelpers.ts
 * Description:
 *   TODO
 */

/* eslint-disable */
import {createTypeContext,lookupFAIMSType} from '../projectSpecification';
import {ProjectID} from '../datamodel';

type validationResult = {
  err: boolean;
  errMessage?: string;
};

export function validateData(
  project_id: ProjectID,
  data: any,
  faimsType: string,
  membersChecked = false
) {
  const context = createTypeContext(project_id);
  const ftype = lookupFAIMSType(faimsType, context);
  const allowValsResult = checkAllowedValues(data, ftype);
  if (allowValsResult.err) {
    return allowValsResult;
  }
  if (!membersChecked) {
    // const checkMembersResult = checkMembers(data, ftype);
    if (allowValsResult.err) {
      return checkMembersResult;
    }
  }
  // const checkTypeResult = checkType(data, ftype);
  // if (checkTypeResult.err) {
  //   return checkTypeResult;
  // }
  return {err: false};
}

function checkAllowedValues(data: any, faimsType: any) {
  return {err: true, errMessage: 'Not implemented'};
}

function checkMembersResult(data: any, faimsType: any) {
  return {err: true, errMessage: 'Not implemented'};
}

function checkTypeResult(data: any, faimsType: any) {
  return {err: true, errMessage: 'Not implemented'};
}
/* tslint:enable */
