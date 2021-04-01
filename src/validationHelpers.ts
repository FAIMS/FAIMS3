import {lookupFAIMSType} from "./dbHelpers";

type validationResult = {
    err: boolean;
    errMessage?: string;
}

export function validateData(
    data: any, faimsType: string, membersChecked:boolean=false,
) {
    let ftype = lookupFAIMSType(faimsType);
    let allowValsResult = checkAllowedValues(data, ftype);
    if (allowValsResult.err === true ) {
        return allowValsResult;
    }
    if (!membersChecked) {
        let checkMemebersResult = checkMembers(data, ftype);
        if (allowValsResult.err === true) {
            return checkMemebersResult;
        }
    }
    let checkTypeResult = checkType(data, ftype);
    if (checkTypeResult.err === true) {
        return checkTypeResult;
    }
    return {err: false}
}


function checkAllowedValues(data:any, faimsType:any) {
    return {err: true, errMessage: "Not implemented"};
}


function checkMemebersResult(data:any, faimsType:any) {
    return {err: true, errMessage: "Not implemented"};
}


function checkTypeResult(data:any, faimsType:any) {
    return {err: true, errMessage: "Not implemented"};
}
