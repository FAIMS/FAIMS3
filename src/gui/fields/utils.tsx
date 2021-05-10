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
