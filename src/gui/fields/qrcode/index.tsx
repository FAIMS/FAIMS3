import {getDefaultuiSetting} from '../BasicFieldSettings';
import {QRCodeFormField} from './QRCodeFormField';
import {
  QRCodeFieldUISetting,
  QRCodeFieldUISpec,
} from './QRCodeFormFieldSettings';

const QRCodeFieldBuilderSettings = [
  QRCodeFieldUISetting(getDefaultuiSetting()),
  QRCodeFieldUISpec,
];

export {QRCodeFormField, QRCodeFieldBuilderSettings};
