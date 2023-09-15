import React from 'react';
import {fireEvent, render} from '@testing-library/react';
import {it, expect} from 'vitest';
import {Field, Formik, FormikConfig, FormikProps} from 'formik';
import {MapFormField} from './MapFormField';
import {RichTextField} from './RichText';

// Borrowed from formik/packages/formik/test/Field.test.tsx

const initialValues = {point: {}};
type Values = typeof initialValues;

function renderForm(
  ui?: React.ReactNode,
  props?: Partial<FormikConfig<Values>>
) {
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
}

it('renders some markdown', async () => {
  const content = 'Hello __World__';
  const {container} = renderForm(
    <Field component={RichTextField} content={content} />
  );
  expect(container.innerHTML).toContain('<strong>World</strong>');
});

it('does not allow unsafe content', async () => {
  const content = 'Hello <script>alert("World")</script>';
  const {container} = renderForm(
    <Field component={RichTextField} content={content} />
  );
  expect(container.innerHTML).not.toContain('<script>alert("World")</script>');
});

export {};
