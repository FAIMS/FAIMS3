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

import React from 'react';
import {Values, initialValues} from './RichText.test';
import {getComponentFromFieldConfig} from '../components/record/fields';
import {render} from '@testing-library/react';
import {Formik, FormikConfig, FormikProps} from 'formik';

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

/**
 * Render a form element via Formik for testing
 * @param ui - the form element to render
 * @param props - properties to inject into the element
 **/
export const renderForm = (
  ui?: React.ReactNode,
  props?: Partial<FormikConfig<Values>>
) => {
  let injected: FormikProps<Values>;
  const {rerender, ...rest} = render(
    <Formik onSubmit={() => {}} initialValues={initialValues} {...props}>
      {(formikProps: FormikProps<Values>) =>
        (injected = formikProps) && ui ? ui : null
      }
    </Formik>
  );

  return {
    getFormProps(): FormikProps<Values> {
      return injected;
    },
    ...rest,
    rerender: () =>
      rerender(
        <Formik onSubmit={() => {}} initialValues={initialValues} {...props}>
          {(formikProps: FormikProps<Values>) =>
            (injected = formikProps) && ui ? ui : null
          }
        </Formik>
      ),
  };
};
/**
 * instantiateField - instantiate a field from a uiSpec for testing
 * @param uiSpec - uiSpec for the field we want to render
 * @returns - the rendered field element
 */
export const instantiateField = (uiSpec: any) => {
  const formProps = {
    values: {},
    errors: {},
    touched: {},
    handleChange: () => {},
    setFieldValue: () => {},
  };
  const element = getComponentFromFieldConfig(uiSpec, 'test', formProps);
  return renderForm(element);
};

export * from '@testing-library/react';

export {customRender as render};
