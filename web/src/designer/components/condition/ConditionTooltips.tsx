import {ConditionBooleanOperator} from '@/designer/types/condition';
import {AddBoxOutlined, Info} from '@mui/icons-material';
import {Box, Stack, Tooltip, Typography} from '@mui/material';
import type {ReactNode} from 'react';
import {conditionBooleanOperatorColours} from '../designer-style';

/**
 * Small titled section used inside tooltip content.
 */
const HelperBox = (props: {title: string; children: ReactNode}) => {
  return (
    <Box sx={{py: 1}}>
      <Typography variant="subtitle2" sx={{mb: 0.6, fontWeight: 800}}>
        {props.title}
      </Typography>
      <Stack spacing={0.6}>{props.children}</Stack>
    </Box>
  );
};

/**
 * Highlights a boolean group operator inside helper text.
 */
const BooleanOperatorText = (props: {operator: ConditionBooleanOperator}) => (
  <Box
    component="span"
    sx={{
      fontWeight: 800,
      fontSize: 'smaller',
      color: conditionBooleanOperatorColours[props.operator],
    }}
  >
    {props.operator.toUpperCase()}
  </Box>
);

/**
 * Underlines important helper text.
 */
const Emphasis = (props: {children: React.ReactNode}) => (
  <Box
    component="span"
    sx={{
      textDecoration: 'underline',
      textUnderlineOffset: 2,
    }}
  >
    {props.children}
  </Box>
);

/**
 * Explains how AND/OR groups work in the condition editor.
 */
export const BooleanOperatorTooltip = () => (
  <Tooltip
    arrow
    placement="top"
    title={
      <Box sx={{maxHeight: '45vh', overflow: 'auto'}}>
        <HelperBox title="AND or OR group">
          <Typography variant="body2">
            The <BooleanOperatorText operator="and" /> and{' '}
            <BooleanOperatorText operator="or" /> allow you to stack multiple
            conditions together.
          </Typography>

          <Typography variant="body2">
            If you choose <BooleanOperatorText operator="and" /> -{' '}
            <Emphasis>Every</Emphasis> condition in the group must be true at
            the same time.
          </Typography>

          <Typography variant="body2">
            If you choose <BooleanOperatorText operator="or" /> -{' '}
            <Emphasis>At least one</Emphasis> of the conditions is true, not
            all.
          </Typography>

          <Typography variant="body2">For example</Typography>

          <Typography variant="body2">
            - 'this' <BooleanOperatorText operator="and" /> 'this' must both be
            true at the same time.
          </Typography>

          <Typography variant="body2">
            - 'this' <BooleanOperatorText operator="or" /> 'this' means either
            of them can be true.
          </Typography>
        </HelperBox>

        <HelperBox title="Multiple groups">
          <Typography variant="body2">
            You can add more complex conditions that contain both{' '}
            <BooleanOperatorText operator="and" /> and{' '}
            <BooleanOperatorText operator="or" /> by clicking the{' '}
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                verticalAlign: 'text-bottom',
              }}
            >
              <AddBoxOutlined
                sx={{
                  fontSize: '1rem',
                  display: 'block',
                }}
              />
            </Box>{' '}
            icon on the right-hand side of a condition row.
          </Typography>

          <Typography variant="body2">
            For example, it lets you show this question when:
          </Typography>

          <Typography variant="body2">
            - 'this' <BooleanOperatorText operator="and" /> 'this' are true
          </Typography>

          <Typography variant="body2">
            <BooleanOperatorText operator="or" />
          </Typography>

          <Typography variant="body2">
            - 'this' <BooleanOperatorText operator="and" /> 'this' are true
          </Typography>
        </HelperBox>
      </Box>
    }
  >
    <Box
      component="span"
      tabIndex={0}
      aria-label="Group operator help"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        ml: 0.5,
        color: 'text.secondary',
        cursor: 'help',
      }}
      onMouseDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
    >
      <Info sx={{fontSize: 20, color: 'info.main'}} />
    </Box>
  </Tooltip>
);
