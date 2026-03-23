import type {FieldType} from '../../../state/initial';

export const cloneField = (field: FieldType): FieldType =>
  JSON.parse(JSON.stringify(field)) as FieldType;

export const withUpdatedField = (
  field: FieldType,
  updater: (nextField: FieldType) => void
): FieldType => {
  const nextField = cloneField(field);
  updater(nextField);
  return nextField;
};
