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
 * Filename: view.tsx
 * Description:
 *   TODO
 */

import {FormikProps} from 'formik';
import React from 'react';

type ViewProps = {
  viewName: string;
  form: any; //FAIMSForm; @TODO fix type
  formProps: FormikProps<{[key: string]: unknown}>;
};

export class ViewComponent extends React.Component<ViewProps> {
  render() {
    const form = this.props.form;
    const viewName = this.props.viewName;
    const fieldNames: Array<string> =
      form.props.ui_specification['views'][viewName]['fields'];
    return (
      <React.Fragment>
        {fieldNames.map(fieldName => {
          return form.getComponentFromField(fieldName, this);
        })}
      </React.Fragment>
    );
  }
}
