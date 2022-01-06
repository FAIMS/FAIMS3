/*
 * Copyright 2021,2022 Macquarie University
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
 * Filename: validation.ts
 * Description:
 *   TODO
 */

import {transformAll} from '@demvsystems/yup-ast';

import {ProjectUIModel} from '../datamodel/ui';
import {getFieldsForViewSet, getFieldNamesFromFields} from '../uiSpecification';

export function getValidationSchemaForViewset(
  ui_specification: ProjectUIModel,
  viewset_name: string
) {
  /***
   * Formik requires a single object for validationSchema, collect these from
   * the ui schema and transform via yup.ast
   */
  const fields = getFieldsForViewSet(ui_specification, viewset_name);
  const fieldNames = getFieldNamesFromFields(fields);
  const validationSchema = Object();
  fieldNames.forEach(fieldName => {
    validationSchema[fieldName] = fields[fieldName]['validationSchema'];
  });
  return transformAll([['yup.object'], ['yup.shape', validationSchema]]);
}
