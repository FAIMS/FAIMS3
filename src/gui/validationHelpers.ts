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
