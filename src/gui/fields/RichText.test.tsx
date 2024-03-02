import React from 'react';
import {it, expect} from 'vitest';
import {Field} from 'formik';
import {RichTextField} from './RichText';
import {renderForm, instantiateField} from './utils';

// Borrowed from formik/packages/formik/test/Field.test.tsx

export const initialValues = {test: {}};
export type Values = typeof initialValues;

it('renders some markdown', async () => {
  const content = 'Hello __World__';
  const {container} = renderForm(
    <Field component={RichTextField} content={content} />,
    initialValues
  );
  expect(container.innerHTML).toContain('<strong>World</strong>');
});

it('does not allow unsafe content', async () => {
  const content = 'Hello <script>alert("World")</script>';
  const {container} = renderForm(
    <Field component={RichTextField} content={content} />,
    initialValues
  );
  expect(container.innerHTML).not.toContain('<script>alert("World")</script>');
});

it('renders from the uiSpec', async () => {
  const uiSpec = {
    'component-namespace': 'faims-custom',
    'component-name': 'RichText',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Unused',
      content: 'Hello __World__',
    },
  };

  const {container} = instantiateField(uiSpec, initialValues);
  console.log('XXXX', container.innerHTML);
  expect(container.innerHTML).toContain('<strong>World</strong>');
});

export {};
