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
import React, {useMemo} from 'react';
import z from 'zod';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

const PercentageSliderPropsSchema = BaseFieldPropsSchema.extend({
  /** Inclusive lower bound (0–100). Defaults to 0. */
  min: z.number().int().min(0).max(100).optional(),
  /** Inclusive upper bound (0–100). Defaults to 100. */
  max: z.number().int().min(0).max(100).optional(),
  /** Step between valid values along the slider. Defaults to 1. */
  stepSize: z.number().int().positive().max(100).optional(),
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
  const step = data.stepSize ?? 1;
  if (max > min && step > max - min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Step size cannot exceed the range between min and max',
      path: ['stepSize'],
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
  const rawStep = props.stepSize ?? 1;
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

  const {minVal, maxVal, step} = useMemo(
    () => resolveBounds(props),
    [props.min, props.max, props.stepSize]
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
          onChange={(_, value) => {
            const next = Array.isArray(value) ? value[0] : value;
            setFieldData(next);
          }}
          onChangeCommitted={() => handleBlur()}
          sx={{
            mt: 0,
            '& .MuiSlider-track': {backgroundColor: '#bdbdbd', border: 'none'},
            '& .MuiSlider-rail': {opacity: 1, backgroundColor: '#e8e8e8'},
            '& .MuiSlider-thumb': {
              width: 16,
              height: 16,
              backgroundColor: '#fff',
              border: '1px solid #bdbdbd',
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
            color: 'success.dark',
            fontSize: 14,
            verticalAlign: 'middle',
          }}
        >
          <RestartAltIcon sx={{fontSize: 18}} />
          Reset
        </Link>
      </Box>
    </FieldWrapper>
  );
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
      message: `Must align with step size (${step})`,
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
  view: {component: DefaultRenderer, config: {}},
};
