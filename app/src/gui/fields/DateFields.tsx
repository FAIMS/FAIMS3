/**
 * Exports a set of date fields which are just different input types of base
 * input field
 */

import {InputBaseProps, InputBaseWrapper} from './InputFieldBase';

type Props = Omit<InputBaseProps, 'type'>;

export const DateField = (props: Props) => {
  return <InputBaseWrapper {...props} type={'date'} />;
};

export const DateTimeField = (props: Props) => {
  return <InputBaseWrapper {...props} type={'datetime-local'} />;
};

export const MonthField = (props: Props) => {
  return <InputBaseWrapper {...props} type={'month'} />;
};
