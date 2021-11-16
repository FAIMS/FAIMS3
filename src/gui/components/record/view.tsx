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

import React from 'react';
import {FormikProps} from 'formik';

import {ProjectUIModel} from '../../../datamodel/ui';
import RecordDraftState from '../../../sync/draft-state';
import {getComponentFromFieldConfig} from './fields';
import {Annotation} from './Annotation';

type ViewProps = {
  viewName: string;
  ui_specification: ProjectUIModel;
  formProps: FormikProps<{[key: string]: unknown}>;
  draftState: RecordDraftState;
  annotation: any;
  handerannoattion: any;
};

export class ViewComponent extends React.Component<ViewProps> {
  render() {
    const ui_specification = this.props.ui_specification;
    const viewName = this.props.viewName;
    const fieldNames: string[] = ui_specification.views[viewName].fields;
    const fields = ui_specification.fields;
    return (
      <React.Fragment>
        {fieldNames.map(fieldName => (
          <>
            {getComponentFromFieldConfig(
              fields[fieldName],
              fieldName,
              this.props.formProps
            )}
            {this.props.annotation !== undefined &&
              fields[fieldName].meta !== undefined &&fields[fieldName]['component-name']!=='BasicAutoIncrementer'&&fields[fieldName]['component-name']!=='TemplatedStringField'&& (
                <Annotation
                  key={'annotation' + fieldName + 'box'}
                  fieldName={fieldName}
                  formProps={this.props.formProps}
                  field={fields[fieldName]}
                  annotation={this.props.annotation}
                  handerannoattion={this.props.handerannoattion}
                />
              )}
          </>
        ))}
      </React.Fragment>
    );
  }
}
