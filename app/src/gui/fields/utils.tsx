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
import {getComponentFromFieldConfig} from '../components/record/fields';
import {render} from '@testing-library/react';
import {Formik, FormikConfig, FormikProps} from 'formik';

/**
 * Render a form element via Formik for testing
 * @param ui - the form element to render
 * @param props - properties to inject into the element
 **/
export const renderForm = (
  ui: React.ReactNode,
  initialValues: any,
  props?: Partial<FormikConfig<any>>
) => {
  let injected: FormikProps<any>;
  const {rerender, ...rest} = render(
    <Formik onSubmit={() => {}} initialValues={initialValues} {...props}>
      {(formikProps: FormikProps<any>) =>
        (injected = formikProps) && ui ? ui : null
      }
    </Formik>
  );
  return {
    getFormProps(): FormikProps<any> {
      return injected;
    },
    ...rest,
    rerender: () =>
      rerender(
        <Formik onSubmit={() => {}} initialValues={initialValues} {...props}>
          {(formikProps: FormikProps<any>) =>
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
export const instantiateField = (uiSpec: any, initialValues: any) => {
  const formProps = {
    values: {},
    errors: {},
    touched: {},
    handleChange: () => {},
    setFieldValue: () => {},
    isSubmitting: false,
    isValidating: false,
    submitCount: 0,
  };
  // can't get all of the members of FormikProps, so just ignore the error
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const element = getComponentFromFieldConfig(uiSpec, 'test', formProps);
  console.log('ELEMENT', element);
  return renderForm(element, initialValues);
};
