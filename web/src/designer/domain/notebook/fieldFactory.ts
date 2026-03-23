import {v4 as uuidv4} from 'uuid';
import type {FieldType} from '../../state/initial';

export const cloneField = (field: FieldType): FieldType =>
  JSON.parse(JSON.stringify(field)) as FieldType;

export const cloneFieldWithDesignerIdentifier = (
  field: FieldType
): FieldType => {
  const cloned = cloneField(field);
  cloned.designerIdentifier = uuidv4();
  return cloned;
};
