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

import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import {alpha, useTheme} from '@mui/material/styles';
import React, {useMemo} from 'react';
import z from 'zod';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {
  DataViewFieldRender,
  EmptyResponsePlaceholder,
  TextWrapper,
} from '../../../rendering/fields';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

const PercentageSliderPropsSchema = BaseFieldPropsSchema.extend({
  /** Inclusive lower bound (0–100). Defaults to 0. */
  min: z.number().int().min(0).max(100).optional(),
  /** Inclusive upper bound (0–100). Defaults to 100. */
  max: z.number().int().min(0).max(100).optional(),
  /** Step between valid values along the slider. Defaults to 1. */
  step: z.number().int().positive().max(100).optional(),
}).superRefine((data, ctx) => {
  const min = data.min ?? 0;
  const max = data.max ?? 100;
  if (min > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum cannot be greater than maximum',
      path: ['min'],
    });
  }
  const step = data.step ?? 1;
  if (max > min && step > max - min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Step cannot exceed the range between min and max',
      path: ['step'],
    });
  }
});

type PercentageSliderProps = z.infer<typeof PercentageSliderPropsSchema>;
type PercentageSliderFullProps = PercentageSliderProps & FormFieldContextProps;

function resolveBounds(props: PercentageSliderProps): {
  minVal: number;
  maxVal: number;
  step: number;
} {
  const minVal = props.min ?? 0;
  const maxVal = props.max ?? 100;
  const rawStep = props.step ?? 1;
  const step =
    Number.isFinite(rawStep) && rawStep >= 1
      ? Math.min(Math.floor(rawStep), 100)
      : 1;
  if (maxVal <= minVal) {
    return {minVal, maxVal: minVal, step: 1};
  }
  return {
    minVal,
    maxVal,
    step: Math.min(step, maxVal - minVal),
  };
}

/** Percent positions (10–90) along the slider track for subtle graduation ticks. */
const GRADUATION_TRACK_PERCENTS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

const SliderGraduationMark = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(function SliderGraduationMark({style, className, ...rest}, ref) {
  const theme = useTheme();
  const incoming = style as React.CSSProperties | undefined;
  const baseTransform = incoming?.transform;
  const transform =
    typeof baseTransform === 'string' &&
    baseTransform.length > 0 &&
    baseTransform !== 'none'
      ? `${baseTransform} translateY(7px)`
      : 'translateX(-50%) translateY(7px)';

  return (
    <span
      ref={ref}
      className={className}
      {...rest}
      style={{
        ...incoming,
        position: 'absolute',
        width: 1,
        height: 6,
        borderRadius: 0,
        backgroundColor: alpha(theme.palette.text.primary, 0.2),
        top: '50%',
        transform,
      }}
    />
  );
});

const PercentageSlider: React.FC<PercentageSliderFullProps> = props => {
  const {
    state,
    setFieldData,
    handleBlur,
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
  } = props;

  const theme = useTheme();

  const {minVal, maxVal, step} = useMemo(
    () => resolveBounds(props),
    [props.min, props.max, props.step]
  );

  const rawValue = state.value?.data;
  const hasValue = rawValue !== null && rawValue !== undefined;
  const numericValue = hasValue ? Number(rawValue) : null;
  const errors = state.meta.errors as unknown as string[];

  const sliderDisplayValue = useMemo(() => {
    if (
      numericValue !== null &&
      !Number.isNaN(numericValue) &&
      maxVal > minVal
    ) {
      return Math.min(maxVal, Math.max(minVal, numericValue));
    }
    return minVal;
  }, [numericValue, minVal, maxVal]);

  const labelLeftPercent =
    maxVal > minVal
      ? ((sliderDisplayValue - minVal) / (maxVal - minVal)) * 100
      : 0;

  const rangeHint =
    minVal === 0 && maxVal === 100
      ? ''
      : `Allowed range: ${minVal}–${maxVal}. Step: ${step}.`;

  const fullHelperText = [helperText, rangeHint].filter(Boolean).join(' ');

  const graduationMarks = useMemo(() => {
    if (maxVal <= minVal) {
      return [];
    }
    const span = maxVal - minVal;
    return GRADUATION_TRACK_PERCENTS.map(p => ({
      value: minVal + (span * p) / 100,
    }));
  }, [minVal, maxVal]);

  return (
    <FieldWrapper
      heading={label}
      subheading={fullHelperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={errors}
    >
      <Box sx={{mt: 0.5}}>
        <Box sx={{height: 22, position: 'relative', mb: 0.25}}>
          {hasValue && numericValue !== null && !Number.isNaN(numericValue) ? (
            <Typography
              variant="body2"
              sx={{
                position: 'absolute',
                left: `${labelLeftPercent}%`,
                transform: 'translateX(-50%)',
                fontWeight: 500,
                color: 'text.primary',
              }}
            >
              {Math.round(numericValue)}
            </Typography>
          ) : null}
        </Box>
        <Slider
          value={sliderDisplayValue}
          min={minVal}
          max={maxVal}
          step={step}
          disabled={disabled || maxVal <= minVal}
          valueLabelDisplay="off"
          marks={graduationMarks}
          slots={{mark: SliderGraduationMark}}
          onChange={(_e, value: number | number[], _a) => {
            const next = Array.isArray(value) ? value[0] : value;
            setFieldData(next);
          }}
          onChangeCommitted={() => handleBlur()}
          sx={{
            mt: 0,
            '& .MuiSlider-track': {
              backgroundColor: theme.palette.grey[400],
              border: 'none',
            },
            '& .MuiSlider-rail': {
              opacity: 1,
              backgroundColor: theme.palette.grey[200],
            },
            '& .MuiSlider-thumb': {
              width: 16,
              height: 16,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.grey[400]}`,
            },
          }}
        />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 0.25,
            color: 'text.secondary',
            fontSize: 12,
          }}
        >
          <span>{minVal}</span>
          <span>{maxVal}</span>
        </Box>
        <Link
          component="button"
          type="button"
          underline="hover"
          onClick={() => {
            setFieldData(null);
            handleBlur();
          }}
          disabled={disabled}
          sx={{
            mt: 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: disabled ? 'default' : 'pointer',
            color: theme.palette.primary.main,
            fontSize: 14,
            verticalAlign: 'middle',
          }}
        >
          <RestartAltIcon sx={{fontSize: 18}} />
          Clear
        </Link>
      </Box>
    </FieldWrapper>
  );
};

/** Formats a stored percentage value for the view-only (DataView) renderer. */
export function formatPercentageViewValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return `${Math.round(numeric)}%`;
}

const PercentageSliderRenderer: DataViewFieldRender = props => {
  const formatted = formatPercentageViewValue(props.value);
  if (formatted === null) {
    return <EmptyResponsePlaceholder />;
  }
  return <TextWrapper content={formatted} />;
};

const valueSchema = (props: PercentageSliderProps): z.ZodTypeAny => {
  const {minVal, maxVal, step} = resolveBounds(props);

  let schema: z.ZodTypeAny = z
    .number({
      message: 'Please select a valid percentage',
    })
    .int()
    .min(minVal, {message: `Must be at least ${minVal}`})
    .max(maxVal, {message: `Must be at most ${maxVal}`});

  if (maxVal > minVal && step >= 1) {
    schema = schema.refine(v => (v - minVal) % step === 0, {
      message: `Must align with step (${step})`,
    });
  }

  return schema;
};

export const percentageSliderFieldSpec: FieldInfo<PercentageSliderFullProps> = {
  namespace: 'faims-custom',
  name: 'PercentageSlider',
  returns: 'faims-core::Integer',
  component: PercentageSlider,
  fieldPropsSchema: PercentageSliderPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {
    component: PercentageSliderRenderer,
    config: {},
    attributes: {singleColumn: false},
  },
};
