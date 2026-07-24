// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Read-only summary for visibility conditions.
 *
 */

import {Box, Paper, Typography} from '@mui/material';
import {getFieldLabel, isBooleanCondition} from '../../../lib/conditionUtils';
import {useAppSelector} from '../../state/hooks';
import {
  allOperators,
  ConditionBooleanOperator,
  RuleCondition,
  type ConditionType,
} from '../../types/condition';
import {conditionBooleanOperatorColours} from '../designer-style';

/**
 * Renders a read-only preview of the current condition.
 *
 * @param props - Summary props.
 * @returns A sentence-style condition summary.
 */
export type ConditionSummaryProps = {
  condition: ConditionType | null;
  showTitle?: boolean;
};
export const ConditionSummary = (props: ConditionSummaryProps) => {
  const allFields = useAppSelector(
    state => state.notebook.uiSpec.present.fields
  );

  /**
   * Resolves a field ID to its display label.
   */
  const getFieldName = (fieldId: string | undefined) => {
    if (!fieldId) return 'Unknown field';
    return allFields[fieldId] ? getFieldLabel(allFields[fieldId]) : fieldId;
  };

  return (
    <Paper variant="outlined" sx={{p: 1}}>
      {!!props.showTitle && (
        <Typography variant="subtitle2">
          Your conditions will be updated here in sentence form
        </Typography>
      )}

      {props.condition ? (
        <ConditionExpression
          condition={props.condition}
          getFieldName={getFieldName}
          depth={0}
        />
      ) : (
        <Typography component="span" variant="body2" color="text.secondary">
          Empty condition
        </Typography>
      )}
    </Paper>
  );
};

/**
 * Renders a condition expression recursively.
 *
 * Boolean groups are rendered with their AND/OR operator between children.
 * Rule conditions are rendered as leaf chips.
 *
 * @param props - Expression props.
 * @returns A rendered condition expression.
 */
const ConditionExpression = (props: {
  condition: ConditionType;
  getFieldName: (fieldId: string | undefined) => string | undefined;
  depth: number;
}) => {
  const {condition, getFieldName, depth} = props;

  if (!isBooleanCondition(condition)) {
    return <ConditionLeaf condition={condition} getFieldName={getFieldName} />;
  }

  const children = condition.conditions ?? [];

  if (children.length === 0) {
    return (
      <Typography component="span" variant="body2" color="text.secondary">
        Empty condition group
      </Typography>
    );
  }

  if (children.length === 1) {
    return (
      <ConditionExpression
        condition={children[0]}
        getFieldName={getFieldName}
        depth={depth}
      />
    );
  }

  const isNestedGroup = depth > 0;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        alignItems: 'center',
        m: isNestedGroup ? 0.25 : 0,
        p: isNestedGroup ? 0.25 : 0,
        borderRadius: 1,
        border: isNestedGroup ? '1px solid' : 'none',
        borderWidth: isNestedGroup ? 1 : 0,
        borderColor: conditionBooleanOperatorColours[condition.operator],
      }}
    >
      {children.map((child, index) => (
        <Box
          key={index}
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
          }}
        >
          {index > 0 && <OperatorChip operator={condition.operator} />}

          <ConditionExpression
            condition={child}
            getFieldName={getFieldName}
            depth={depth + 1}
          />
        </Box>
      ))}
    </Box>
  );
};

/**
 * Renders the AND/OR text between condition expressions.
 *
 * @param props - Operator chip props.
 * @returns A styled boolean operator label.
 */
const OperatorChip = (props: {operator: ConditionBooleanOperator}) => {
  return (
    <Box
      component="span"
      sx={{
        fontWeight: 800,
        fontSize: 'small',
        color: conditionBooleanOperatorColours[props.operator],
        whiteSpace: 'nowrap',
        px: 0.25,
      }}
    >
      {props.operator.toUpperCase()}
    </Box>
  );
};

/**
 * Renders a single rule condition as a compact field/operator/value chip.
 *
 * @param props - Leaf condition props.
 * @returns A rendered rule condition.
 */
const ConditionLeaf = (props: {
  condition: RuleCondition;
  getFieldName: (fieldId: string | undefined) => string | undefined;
}) => {
  const {condition, getFieldName} = props;

  const fieldName = getFieldName(condition.field) ?? condition.field ?? '';
  const operatorLabel =
    allOperators.get(condition.operator)?.toLowerCase() ?? condition.operator;
  const valueLabel = formatConditionValue(condition.value);

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 0.5,
        px: 0.25,
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
      }}
    >
      <Box component="span" sx={{fontWeight: 700}}>
        {fieldName}
      </Box>

      <Box component="span" sx={{color: 'text.secondary'}}>
        {operatorLabel}
      </Box>

      <Box component="span" sx={{fontWeight: 700}}>
        {valueLabel}
      </Box>
    </Box>
  );
};

/**
 * Formats a condition value for display in the summary.
 *
 * @param value - The stored rule value.
 * @returns A readable value label.
 */
function formatConditionValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'checked' : 'not checked';
  if (value === null || value === undefined || value === '') return 'empty';
  return String(value);
}
