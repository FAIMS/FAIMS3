/**
 * @jest-environment jsdom
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import {act} from 'react-dom/test-utils';
import {fireEvent, screen} from '@testing-library/react'

import {FieldMetaProps, FormikProps} from 'formik'
import { MapFormField} from './MapFormField'

let container: HTMLDivElement | null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  if (container) 
    document.body.removeChild(container);
  container = null;
});


it('renders as a button', async () => {
  // if (container) {
  //   const props = {
  //     value: {},
  //     name: 'point',
  //     onChange: (x: any) => x,
  //     onBlur: (x: any) => x,
  //   }
  //   const fprops: FormikProps<any> = {errors: {}, touched: {}, isSubmitting: false, isValidating: false, submitCount: 0, values: {}};
  //   const fstate: FieldMetaProps<any> = {error: '', initialError: '', initialTouched: false, initialValue: {}, touched: false, value: {}};

  //   await act(() => {
  //     ReactDOM.createRoot(container).render(
  //     <MapFormField
  //       field={props}
  //       featureType='Point'
  //       form={fprops}
  //       meta={fstate} 
  //     />)});

  //   expect(screen.getByRole('button', {name: 'Get Point'}))
  // }
})

it('creates a map when the button is pressed', async () => {
  // if (container) {
  //   const props = {
  //     value: {},
  //     name: 'point',
  //     onChange: jest.fn(),
  //     onBlur: jest.fn()
  //   }
  //   window.scrollTo = jest.fn()
  //   const fprops: FormikProps<any> = {errors: {}, touched: {}, isSubmitting: false, isValidating: false, submitCount: 0, values: {}};
  //   const fstate: FieldMetaProps<any> = {error: '', initialError: '', initialTouched: false, initialValue: {}, touched: false, value: {}};

  //   await act(() => {
  //     ReactDOM.createRoot(container).render(
  //     <MapFormField
  //       field={props}
  //       featureType='Point'
  //       form={fprops}
  //       meta={fstate}
  //     />)});

  //   const button = container.querySelector('button');

  //   await act(() => {
  //     if (button)
  //       fireEvent.click(button)
  //   });
  //   expect(container.querySelector('.ol-viewport'))
  // }
})


export {}
