import React from 'react';
import {fireEvent, render} from '@testing-library/react';
import {it, expect} from 'vitest';
import {Field, Formik, FormikConfig, FormikProps} from 'formik';
import {MapFormField} from './MapFormField';
import {noop} from 'lodash';

// Borrowed from formik/packages/formik/test/Field.test.tsx

const initialValues = {point: {}};
type Values = typeof initialValues;

function renderForm(
  ui?: React.ReactNode,
  props?: Partial<FormikConfig<Values>>
) {
  let injected: FormikProps<Values>;
  const {rerender, ...rest} = render(
    <Formik onSubmit={noop} initialValues={initialValues} {...props}>
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
        <Formik onSubmit={noop} initialValues={initialValues} {...props}>
          {(formikProps: FormikProps<Values>) =>
            (injected = formikProps) && ui ? ui : null
          }
        </Formik>
      ),
  };
}

it('renders as a button', async () => {
  const {container} = renderForm(
    <Field component={MapFormField} name="point" featureType="Point" />
  );
  expect(container.querySelector('button'));
});

it('creates a map when the button is pressed', async () => {
  const {container} = renderForm(
    <Field component={MapFormField} name="point" featureType="Point" />
  );

  const button = container.querySelector('button');
  if (button) fireEvent.click(button);
  expect(container.querySelector('.ol-viewport'));
});

export {};
