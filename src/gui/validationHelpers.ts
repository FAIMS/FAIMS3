/* eslint-disable */
import {lookupFAIMSType} from './dbHelpers';

type validationResult = {
  err: boolean;
  errMessage?: string;
};

export function validateData(
  data: any,
  faimsType: string,
  membersChecked = false
) {
  const ftype = lookupFAIMSType(faimsType);
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
