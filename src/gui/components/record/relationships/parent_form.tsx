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
 * Filename: relationships/parent_panel.tsx
 * Description:
 *   This is component to display inherit data from parent
 */

import React from 'react';

import {ParentLinkProps} from './types';
import {Formik, Form} from 'formik';
import {ViewComponent} from '../view';
import {ProjectUIModel} from 'faims3-datamodel';

export type ParentFormProps = {
  parentRecords: Array<ParentLinkProps> | null;
  ui_specification: ProjectUIModel;
};

export default function ParentForm(props: ParentFormProps) {
  const {ui_specification, parentRecords} = props;
  if (
    parentRecords === null ||
    parentRecords.length === 0 ||
    parentRecords[0]['persistentData'] === undefined ||
    parentRecords[0].type === undefined
  )
    return <></>;
  const values = parentRecords[0]['persistentData'].data;
  const viewName = parentRecords[0].type;
  const annotation = parentRecords[0]['persistentData'].annotations;
  const fieldNames = Object.keys(parentRecords[0]['persistentData'].data);

  const updateannotation = () => {
    return;
  };
  return (
    <Formik
      initialValues={values}
      validateOnMount={false}
      onSubmit={() => console.log('')}
    >
      {formProps => {
        return (
          <Form>
            <ViewComponent
              viewName={viewName}
              ui_specification={ui_specification}
              formProps={formProps}
              annotation={annotation}
              handleAnnotation={updateannotation}
              fieldNames={fieldNames}
              disabled={true}
            />
          </Form>
        );
      }}
    </Formik>
  );
}
