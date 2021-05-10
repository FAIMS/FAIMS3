import React from 'react';
import {Field} from 'formik';
import * as Yup from 'yup';
import {render, fireEvent} from './utils';

import {Checkbox} from './checkbox';

test('renders as formik component', () => {
  const onSubmit = jest.fn();
  const {asFragment} = render(
    <Field component={Checkbox} name="checked" type="checkbox" />,
    {
      initialValues: {
        checked: false,
      },
      onSubmit,
    }
  );

  expect(asFragment()).toMatchSnapshot();
});

test('submitting checked is true', async () => {
  // given
  const onSubmit = jest.fn();
  const {getByTestId, findByText} = render(
    <Field
      component={Checkbox}
      name="checked"
      label="Checkbox"
      type="checkbox"
      inputProps={{
        'data-testid': 'checkbox',
      }}
    />,
    {
      onSubmit,
      initialValues: {
        checked: true,
      },
    }
  );

  const input = getByTestId('checkbox');
  const submit = getByTestId('submit');

  // when
  fireEvent.change(input, {target: {value: 'checked'}});
  fireEvent.click(submit);

  await findByText('submitted');

  // then
  expect(onSubmit).toBeCalledWith(
    {
      checked: true,
    },
    expect.anything()
  );
});

test('pass FormControlLabelProps and FormHelperTextProps (checked false)', async () => {
  // given
  const onSubmit = jest.fn();
  const {getByTestId, findByText, asFragment} = render(
    <Field
      component={Checkbox}
      name="checked"
      label="Checkbox"
      type="checkbox"
      inputProps={{
        'data-testid': 'checkbox',
      }}
      FormControlLabelProps={{label: 'Terms and Conditions'}}
      FormHelperTextProps={{
        children: 'Read the terms and conditions carefully.',
      }}
    />,
    {
      onSubmit,
      initialValues: {
        checked: false,
      },
    }
  );

  expect(asFragment()).toMatchSnapshot();

  const input = getByTestId('checkbox');
  const submit = getByTestId('submit');

  // when
  fireEvent.change(input, {target: {value: 'checked'}});
  fireEvent.click(submit);

  await findByText('submitted');
  await findByText('Terms and Conditions');
  await findByText('Read the terms and conditions carefully.');

  // then
  expect(onSubmit).toBeCalledWith(
    {
      checked: false,
    },
    expect.anything()
  );
});

test('displays error if field is touched and checkbox is false, if validation schema requires it to be true', async () => {
  const validationSchema = Yup.object().shape({
    checked: Yup.bool()
      .oneOf([true], 'You must accept the terms and conditions')
      .required(),
  });

  const onSubmit = jest.fn();
  const {getByTestId, findByText, asFragment} = render(
    <Field
      component={Checkbox}
      name="checked"
      label="Checkbox"
      type="checkbox"
      inputProps={{
        'data-testid': 'checkbox',
      }}
      FormControlLabelProps={{label: 'Terms and Conditions'}}
      FormHelperTextProps={{
        children: 'Read the terms and conditions carefully.',
      }}
    />,
    {
      onSubmit,
      initialValues: {
        checked: false,
      },
      validationSchema: validationSchema,
    }
  );

  expect(asFragment()).toMatchSnapshot();

  const input = getByTestId('checkbox');

  // Call blur without inputting anything which should trigger a validation error
  fireEvent.blur(input);

  // The validation message should be shown and the label should still be present
  await findByText('Terms and Conditions');
  // check for Mui-error in classList
  const errorText = await findByText(
    'You must accept the terms and conditions'
  );
  expect(errorText).toHaveClass('Mui-error');
});
