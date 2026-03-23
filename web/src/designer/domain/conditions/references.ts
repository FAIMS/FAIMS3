import type {FieldType} from '../../state/initial';
import type {ConditionType} from '../../types/condition';

type ViewConditionMap = Record<
  string,
  {
    label: string;
    condition?: ConditionType;
  }
>;

const doesConditionContainValue = (
  condition: ConditionType,
  fieldName: string,
  expectedValue: string
): boolean => {
  if (
    (condition.operator === 'and' || condition.operator === 'or') &&
    condition.conditions
  ) {
    return condition.conditions.some(subCondition =>
      doesConditionContainValue(subCondition, fieldName, expectedValue)
    );
  }

  if (condition.field !== fieldName) {
    return false;
  }

  if (Array.isArray(condition.value)) {
    return condition.value.includes(expectedValue);
  }

  return condition.value === expectedValue;
};

export const findOptionReferences = (
  allFields: Record<string, FieldType>,
  allFviews: ViewConditionMap,
  fieldName: string,
  oldValue: string
): string[] => {
  const references: string[] = [];

  for (const [fieldId, fieldDefinition] of Object.entries(allFields)) {
    if (
      fieldDefinition.condition &&
      doesConditionContainValue(fieldDefinition.condition, fieldName, oldValue)
    ) {
      references.push(
        `Field: ${fieldDefinition['component-parameters'].label ?? fieldId}`
      );
    }
  }

  for (const [sectionId, sectionDefinition] of Object.entries(allFviews)) {
    if (
      sectionDefinition.condition &&
      doesConditionContainValue(
        sectionDefinition.condition,
        fieldName,
        oldValue
      )
    ) {
      references.push(`Section: ${allFviews[sectionId].label}`);
    }
  }

  return references;
};

export const updateConditionReferences = (
  condition: ConditionType,
  fieldName: string,
  oldValue: string,
  newValue: string
): ConditionType => {
  if (
    (condition.operator === 'and' || condition.operator === 'or') &&
    condition.conditions
  ) {
    return {
      ...condition,
      conditions: condition.conditions.map(subCondition =>
        updateConditionReferences(subCondition, fieldName, oldValue, newValue)
      ),
    };
  }

  if (condition.field !== fieldName) {
    return condition;
  }

  if (Array.isArray(condition.value)) {
    return {
      ...condition,
      value: condition.value.map(value =>
        value === oldValue ? newValue : value
      ),
    };
  }

  if (condition.value === oldValue) {
    return {
      ...condition,
      value: newValue,
    };
  }

  return condition;
};
