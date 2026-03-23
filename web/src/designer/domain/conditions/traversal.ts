import type {ConditionType} from '../../components/condition/types';

export const isFieldUsedInCondition = (
  condition: ConditionType | null | undefined,
  fieldName: string
): boolean => {
  if (!condition) return false;

  if (condition.field === fieldName) {
    return true;
  }

  if (
    (condition.operator === 'and' || condition.operator === 'or') &&
    condition.conditions
  ) {
    return condition.conditions.some(subCondition =>
      isFieldUsedInCondition(subCondition, fieldName)
    );
  }

  return false;
};

export const replaceFieldInCondition = (
  condition: ConditionType | null | undefined,
  oldFieldName: string,
  newFieldName: string
): ConditionType | null | undefined => {
  if (!condition) return condition;

  if (condition.field === oldFieldName) {
    return {...condition, field: newFieldName};
  }

  if (
    (condition.operator === 'and' || condition.operator === 'or') &&
    condition.conditions
  ) {
    return {
      ...condition,
      conditions: condition.conditions.map(subCondition =>
        replaceFieldInCondition(subCondition, oldFieldName, newFieldName)
      ) as ConditionType[],
    };
  }

  return condition;
};
