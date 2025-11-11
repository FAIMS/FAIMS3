/**
 * A set of methods for performing validation.
 */

import {UISpecification} from '@faims3/data-model';
import {FaimsFormData} from '../formModule/types';

export function validateData({
  data,
  formId,
  uiSpec,
}: {
  data: FaimsFormData;
  formId: string;
  uiSpec: UISpecification;
}) : ValidationResult {}
