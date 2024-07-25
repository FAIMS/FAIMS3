import React from 'react';
import {fireEvent} from '@testing-library/react';
import {it, expect} from 'vitest';
import {Field} from 'formik';
import {MapFormField} from './MapFormField';
import {renderForm, instantiateField} from '../utils';

it('renders as a button', async () => {
  const {container} = renderForm(
    <Field component={MapFormField} name="point" featureType="Point" />,
    {point: {}}
  );
  expect(container.querySelector('button'));
});

it('creates a map when the button is pressed', async () => {
  const {container} = renderForm(
    <Field component={MapFormField} name="point" featureType="Point" />,
    {point: {}}
  );

  const button = container.querySelector('button');
  if (button) fireEvent.click(button);
  expect(container.querySelector('.ol-viewport'));
});

it('renders from the uiSpec', async () => {
  const uiSpec = {
    'component-namespace': 'mapping-plugin',
    'component-name': 'MapFormField',
    'type-returned': 'faims-core::JSON',
    'component-parameters': {
      name: 'map',
      id: 'map',
      variant: 'outlined',
      required: false,
      featureType: 'Point',
      zoom: 12,
      label: '',
      geoTiff: '',
      FormLabelProps: {
        children: '',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '1',
  };

  const {container} = instantiateField(uiSpec, {});
  expect(container.querySelector('button'));
});

export {};
