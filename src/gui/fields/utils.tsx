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
 * Filename: utils.tsx
 * Description:
 *   TODO
 */

import * as React from 'react';
import {render, RenderOptions} from '@testing-library/react';
import {Formik, Form, FormikConfig} from 'formik';
import '@testing-library/jest-dom/extend-expect';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
interface Props extends Omit<FormikConfig<any>, 'render' | 'children'> {
  children?: React.ReactNode;
}

function FormikWrapper({children, ...config}: Props): React.ReactElement {
  return (
    <Formik {...config}>
      {({submitForm, submitCount}) => {
        return (
          <Form data-testid="form">
            {children}
            {submitCount > 0 && <span>submitted</span>}
            <button data-testid="submit" onClick={submitForm}>
              submit
            </button>
          </Form>
        );
      }}
    </Formik>
  );
}

const customRender = (
  ui: React.ReactElement,
  formikOpts: Omit<Props, 'children'>,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, {
    wrapper: function CustomRendererWrapper(props) {
      return <FormikWrapper {...formikOpts} {...props} />;
    },
    ...options,
  });
};

export * from '@testing-library/react';

export {customRender as render};
