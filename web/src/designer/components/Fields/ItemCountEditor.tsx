// SPDX-License-Identifier: Apache-2.0

/**
 * @file Reusable minimum/maximum item-count controls for the notebook designer.
 *
 * Used by TakePhoto and FileUploader.
 *
 * Each bound is either unrestricted (null) or a positive integer.
 * Checking "No limit" clears the bound; unchecking enables the input.
 *
 * A positive minimum makes the field required. Clearing the minimum
 * removes Required. Changes are committed to Redux through onChange.
 *
 * Local drafts allow users to edit incomplete or invalid values without
 * overwriting the last valid configuration.
 */

import type {GridProps} from '@mui/material';
import {Box, Checkbox, FormControlLabel, Grid, TextField} from '@mui/material';
import {useEffect, useRef, useState} from 'react';

import {withUpdatedField} from '../../features/fields/shared/updateField';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import type {FieldType} from '../../state/initial';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {SimpleFieldWrapper} from './SimpleFieldWrapper';

/** Component parameter keys for minimum and maximum item counts. */
type CountPropertyKey = 'minItems' | 'maxItems';

type ItemCountEditorProps = {
  fieldName: string;
  itemLabel: string;
  /** Responsive size of each minimum/maximum settings group. */
  inputSize?: GridProps['size'];
};

/** Read a configured count. Null or missing means unrestricted. */
function getConfiguredCount(
  field: FieldType,
  key: CountPropertyKey
): number | null {
  const value = field['component-parameters'][key];
  return typeof value === 'number' ? value : null;
}

/**
 * Parse an input as a positive integer.
 *
 * @Returns
 * - a number when valid,
 * - null when empty,
 * - or undefined when invalid.
 */
function parseCount(value: string): number | null | undefined {
  if (value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

/** Configure minimum and maximum item counts for a field. */
export const ItemCountEditor = ({
  fieldName,
  itemLabel,
  inputSize = {xs: 12, sm: 6, md: 4},
}: ItemCountEditorProps) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const minItems = getConfiguredCount(field, 'minItems');
  const maxItems = getConfiguredCount(field, 'maxItems');
  const fieldRequired = field['component-parameters'].required === true;

  // Local checkbox state lets users enable an empty input before entering a value.
  const [noMinLimit, setNoMinLimit] = useState(
    minItems === null && !fieldRequired
  );
  const [noMaxLimit, setNoMaxLimit] = useState(maxItems === null);

  // Keep incomplete drafts local; only valid values are saved to Redux.
  const [minDraft, setMinDraft] = useState(minItems?.toString() ?? '');
  const [maxDraft, setMaxDraft] = useState(maxItems?.toString() ?? '');

  // Track previous Redux values to distinguish external changes from local edits.
  const previousSaved = useRef({
    minItems,
    maxItems,
    fieldRequired,
  });

  // Synchronize inputs with external Redux changes,
  // Preserve matching local drafts to avoid interrupting typing (e.g. "02").
  useEffect(() => {
    const previous = previousSaved.current;
    const requiredUnchecked = previous.fieldRequired && !fieldRequired;

    // Clear the minimum draft when Required is unchecked.
    // Otherwise, sync changes while preserving matching local drafts.
    if (requiredUnchecked || previous.minItems !== minItems) {
      setMinDraft(current => {
        if (requiredUnchecked) return '';
        if (parseCount(current) === minItems) return current;
        return minItems?.toString() ?? '';
      });
    }

    // Sync the minimum "No limit" checkbox.
    if (
      previous.minItems !== minItems ||
      previous.fieldRequired !== fieldRequired
    ) {
      setNoMinLimit(minItems === null && !fieldRequired);
    }

    // Sync the maximum input and its "No limit" checkbox.
    if (previous.maxItems !== maxItems) {
      setMaxDraft(current => {
        if (parseCount(current) === maxItems) return current;
        return maxItems?.toString() ?? '';
      });

      setNoMaxLimit(maxItems === null);
    }

    previousSaved.current = {
      minItems,
      maxItems,
      fieldRequired,
    };
  }, [minItems, maxItems, fieldRequired]);

  /**
   * Commit a valid count to Redux.
   *
   * Minimum also updates Required in the same action.
   * Maximum does not affect Required.
   */
  const commitCount = (key: CountPropertyKey, value: number | null) => {
    if (value !== null && (!Number.isSafeInteger(value) || value < 1)) {
      return;
    }

    const currentValue = key === 'minItems' ? minItems : maxItems;
    const otherValue = key === 'minItems' ? maxItems : minItems;

    // Do not save contradictory minimum/maximum bounds.
    if (
      value !== null &&
      otherValue !== null &&
      (key === 'minItems' ? value > otherValue : value < otherValue)
    ) {
      return;
    }

    const requiredChanged =
      key === 'minItems' && fieldRequired !== (value !== null);

    // Avoid adding unchanged values to Redux undo history.
    if (value === currentValue && !requiredChanged) {
      return;
    }

    const newField = withUpdatedField(field, nextField => {
      const params = nextField['component-parameters'];
      params[key] = value;

      // Keep Required and Minimum in the same Redux update.
      if (key === 'minItems') {
        params.required = value !== null;
      }
    });

    dispatch(fieldUpdated({fieldName, newField}));
  };

  /**
   * Toggle a bound between unrestricted and configured.
   *
   * Checking "No limit" clears the saved bound immediately.
   * Unchecking only enables the input, without saving an empty value.
   */
  const handleNoLimitChange = (key: CountPropertyKey, checked: boolean) => {
    if (key === 'minItems') {
      setNoMinLimit(checked);
      if (checked) setMinDraft('');
    } else {
      setNoMaxLimit(checked);
      if (checked) setMaxDraft('');
    }

    if (checked) {
      commitCount(key, null);
    }
  };

  /**
   * Update the local draft and immediately commit valid values.
   * Empty or invalid inputs remain local until corrected.
   */
  const handleCountChange = (key: CountPropertyKey, value: string) => {
    if (key === 'minItems') {
      setMinDraft(value);
    } else {
      setMaxDraft(value);
    }

    const parsed = parseCount(value);

    if (typeof parsed === 'number') {
      commitCount(key, parsed);
    }
  };

  // Validate local drafts rather than the last saved Redux values.
  const parsedMin = parseCount(minDraft);
  const parsedMax = parseCount(maxDraft);

  const invalidMin = !noMinLimit && parsedMin === undefined;
  const invalidMax = !noMaxLimit && parsedMax === undefined;

  const missingMin = !noMinLimit && parsedMin === null;
  const missingMax = !noMaxLimit && parsedMax === null;

  const invalidRange =
    !noMinLimit &&
    !noMaxLimit &&
    typeof parsedMin === 'number' &&
    typeof parsedMax === 'number' &&
    parsedMin > parsedMax;

  return (
    <Box sx={{width: '100%'}}>
      <Grid container spacing={2}>
        {/* Minimum item count also controls Required. */}
        <Grid size={inputSize}>
          <SimpleFieldWrapper heading={`Minimum ${itemLabel}`}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                columnGap: 1,
                rowGap: 1,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={noMinLimit}
                    onChange={event =>
                      handleNoLimitChange('minItems', event.target.checked)
                    }
                  />
                }
                label="No limit"
                sx={{mr: 0, flexShrink: 0, alignSelf: 'start'}}
              />

              <TextField
                type="number"
                size="small"
                value={minDraft}
                disabled={noMinLimit}
                required={!noMinLimit}
                placeholder="Minimum"
                onChange={event =>
                  handleCountChange('minItems', event.target.value)
                }
                error={invalidMin || missingMin || invalidRange}
                helperText={
                  missingMin
                    ? 'Enter a minimum.'
                    : invalidMin
                      ? 'Enter a positive integer, or check "No limit".'
                      : invalidRange
                        ? 'Minimum cannot exceed maximum.'
                        : undefined
                }
                slotProps={{
                  htmlInput: {min: 1, step: 1},
                }}
                sx={{
                  flex: '1 1 120px',
                  minWidth: 100,
                }}
              />
            </Box>
          </SimpleFieldWrapper>
        </Grid>

        {/* Maximum item count does not affect Required. */}
        <Grid size={inputSize}>
          <SimpleFieldWrapper heading={`Maximum ${itemLabel}`}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                columnGap: 1,
                rowGap: 1,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={noMaxLimit}
                    onChange={event =>
                      handleNoLimitChange('maxItems', event.target.checked)
                    }
                  />
                }
                label="No limit"
                sx={{mr: 0, flexShrink: 0, alignSelf: 'start'}}
              />

              <TextField
                type="number"
                size="small"
                value={maxDraft}
                disabled={noMaxLimit}
                required={!noMaxLimit}
                placeholder="Maximum"
                onChange={event =>
                  handleCountChange('maxItems', event.target.value)
                }
                error={invalidMax || missingMax || invalidRange}
                helperText={
                  missingMax
                    ? 'Enter a maximum.'
                    : invalidMax
                      ? 'Enter a positive integer, or check "No limit".'
                      : invalidRange
                        ? 'Maximum cannot be less than minimum.'
                        : undefined
                }
                slotProps={{
                  htmlInput: {min: 1, step: 1},
                }}
                sx={{
                  flex: '1 1 120px',
                  minWidth: 100,
                }}
              />
            </Box>
          </SimpleFieldWrapper>
        </Grid>
      </Grid>
    </Box>
  );
};
