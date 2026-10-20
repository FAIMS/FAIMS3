// SPDX-License-Identifier: Apache-2.0

/*
 * RadioGroup Component
 * This component renders a group of radio buttons using Material-UI.
 * It integrates with the form system for managing state and includes:
 * - A heading (field label) rendered using FieldWrapper.
 * - A subheading (help text) rendered using FieldWrapper.
 * - Toggle behavior: clicking a selected radio deselects it.
 * - Rich text labels: option labels support sanitized HTML content.
 * - "Other" option: allows users to enter custom text beyond predefined choices.
 * Props:
 * - label (string, optional): The field label displayed as a heading.
 * - helperText (string, optional): The field help text displayed below the heading.
 * - ElementProps (object): Contains the radio options array and enableOtherOption flag.
 * - required: To visually show if the field is required.
 * - disabled: Whether the field is disabled.
 */

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  ListItemText,
  MenuItem,
  Select as MuiSelect,
  OutlinedInput,
  SelectChangeEvent,
  TextField,
} from '@mui/material';
import FormControl from '@mui/material/FormControl';
import MuiRadio from '@mui/material/Radio';
import MuiRadioGroup from '@mui/material/RadioGroup';
import {alpha} from '@mui/material/styles';
import {z} from 'zod';
import {schemaWithAbsent} from '../../../validationModule/readableErrors';
import {BaseFieldParametersSchema, INPUT_LIMITS} from '@faims3/data-model';
import {FullFieldProps} from '../../../formModule/types';
import {ChoiceElementPropsSchema, ChoiceOption} from '../choiceFieldParams';
import {
  OTHER_MARKER,
  OTHER_PREFIX,
  otherTextFieldSx,
  useOtherOption,
} from '../../../hooks/useOtherOption';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import {contentToSanitizedHtml} from '../RichText/DomPurifier';
import FieldWrapper from '../wrappers/FieldWrapper';
import {useRef, useState} from 'react';

// ============================================================================
// Types & Schema
// ============================================================================

export const RadioGroupFieldPropsSchema = BaseFieldParametersSchema.extend({
  ElementProps: ChoiceElementPropsSchema,
});

export type RadioGroupFieldProps = z.infer<typeof RadioGroupFieldPropsSchema>;
type FieldProps = RadioGroupFieldProps & FullFieldProps;

// ============================================================================
// Main Component
// ============================================================================

/**
 * RadioGroup Component - A reusable radio button group with form integration.
 * Supports toggle behavior where clicking a selected option deselects it.
 * Supports "Other" option for custom text entry.
 */
export const RadioGroup = (props: FieldProps) => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    state,
    setFieldData,
    handleBlur,
    ElementProps,
  } = props;

  const rawValue = (state.value?.data as string) ?? '';
  const enableOtherOption = ElementProps.enableOtherOption ?? false;
  const otherOptionPosition = ElementProps.options.length;
  const predefinedValues = ElementProps.options.map(opt => opt.value);
  // if expandedChecklist is missing, we default to true - expanded by default
  const expandedChecklist = ElementProps.expandedChecklist !== false;

  const {setOtherSelected, hasOtherSelected, otherText, handleOtherTextChange} =
    useOtherOption({
      enableOtherOption,
      rawValue,
      predefinedValues,
      setFieldData,
    });
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const displayValue = hasOtherSelected
    ? OTHER_MARKER
    : predefinedValues.includes(rawValue)
      ? rawValue
      : '';

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedValue = event.target.value;

    if (selectedValue === OTHER_MARKER) {
      if (hasOtherSelected) {
        setOtherSelected(false);
        setFieldData('');
      } else {
        // Store "Other: " prefix immediately so required validation passes
        setOtherSelected(true);
        setFieldData(OTHER_PREFIX);
      }
    } else {
      setOtherSelected(false);
      const newValue = displayValue === selectedValue ? '' : selectedValue;
      setFieldData(newValue);
    }
  };

  const handleClearRequest = () => {
    if (!rawValue) return;
    setConfirmClearOpen(true);
  };

  const handleConfirmClear = () => {
    setOtherSelected(false);
    setFieldData('');
    setConfirmClearOpen(false);
  };

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <FormControl
        sx={{
          width: '100%',
          '& .MuiSelect-select': {
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            padding: '12px',
          },
        }}
      >
        {expandedChecklist && (
          <RadioGroupWidget
            displayValue={displayValue}
            options={ElementProps.options}
            enableOtherOption={enableOtherOption}
            otherOptionPosition={otherOptionPosition}
            handleChange={handleChange}
            handleBlur={handleBlur}
            hasOtherSelected={hasOtherSelected}
            setOtherSelected={setOtherSelected}
            otherText={otherText}
            handleOtherTextChange={handleOtherTextChange}
            disabled={disabled}
          />
        )}
        {!expandedChecklist && (
          <DropDownWidget
            displayValue={displayValue}
            options={ElementProps.options}
            enableOtherOption={enableOtherOption}
            otherOptionPosition={otherOptionPosition}
            handleChange={handleChange}
            handleBlur={handleBlur}
            hasOtherSelected={hasOtherSelected}
            setOtherSelected={setOtherSelected}
            otherText={otherText}
            handleOtherTextChange={handleOtherTextChange}
            disabled={disabled}
          />
        )}
        <Button
          variant="outlined"
          size="medium"
          onClick={handleClearRequest}
          disabled={disabled || !rawValue}
          sx={{
            mt: 1,
            px: 1.75,
            py: 0.625,
            minHeight: 40,
            borderRadius: 1.5,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: 0.1,
            width: 'fit-content',
            color: 'text.secondary',
            borderColor: theme => alpha(theme.palette.text.secondary, 0.5),
            '&:hover': {
              borderColor: 'text.secondary',
              backgroundColor: 'action.hover',
            },
            '&.Mui-disabled': {
              color: 'action.disabled',
              borderColor: 'action.disabledBackground',
            },
          }}
        >
          Clear
        </Button>
      </FormControl>
      <Dialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear selected option?</DialogTitle>
        <DialogContent>
          Are you sure you want to clear this selected option?
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmClearOpen(false)}
            sx={{textTransform: 'none'}}
          >
            Cancel
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={handleConfirmClear}
            sx={{textTransform: 'none'}}
          >
            Clear
          </Button>
        </DialogActions>
      </Dialog>
    </FieldWrapper>
  );
};

interface WidgetProps {
  displayValue: string;
  options: {value: string; label: string}[];
  enableOtherOption: boolean;
  otherOptionPosition: number;
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  hasOtherSelected: boolean;
  setOtherSelected: (value: boolean) => void;
  otherText: string;
  handleOtherTextChange: (value: string) => void;
  disabled: boolean | undefined;
}

/**
 * Render the select as a radio group component
 */
const RadioGroupWidget = ({
  displayValue,
  options,
  enableOtherOption,
  otherOptionPosition,
  handleChange,
  handleBlur,
  hasOtherSelected,
  setOtherSelected,
  otherText,
  handleOtherTextChange,
  disabled,
}: WidgetProps) => {
  return (
    <>
      <MuiRadioGroup
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
      >
        {/* Render options and "Other" in correct order */}
        {(() => {
          const items: React.ReactNode[] = [];
          let optionIndex = 0;

          // Render the "Other" option component
          const renderOtherOption = () => (
            <FormControlLabel
              key="__other__"
              value={OTHER_MARKER}
              control={
                <MuiRadio
                  sx={{
                    alignSelf: 'flex-start',
                    paddingTop: '6px',
                  }}
                />
              }
              label={
                <TextField
                  size="small"
                  placeholder="Other"
                  value={otherText}
                  onChange={e => {
                    if (!hasOtherSelected && e.target.value.length > 0) {
                      setOtherSelected(true);
                    }
                    handleOtherTextChange(e.target.value);
                  }}
                  onFocus={() => {
                    if (!hasOtherSelected) {
                      setOtherSelected(true);
                    }
                  }}
                  onBlur={handleBlur}
                  disabled={disabled}
                  variant="standard"
                  multiline
                  slotProps={{
                    htmlInput: {
                      maxLength: INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH,
                    },
                  }}
                  sx={{
                    minWidth: '200px',
                    marginTop: '2px',
                    ...otherTextFieldSx,
                  }}
                />
              }
              disabled={disabled}
              sx={{
                alignItems: 'flex-start',
                marginBottom: 1,
                '& .MuiFormControlLabel-label': {
                  display: 'block',
                  marginTop: '0px',
                  alignSelf: 'flex-start',
                },
              }}
            />
          );

          // Render a regular option
          const renderOption = (option: ChoiceOption) => (
            <FormControlLabel
              key={option.key || option.value}
              value={option.value}
              control={
                <MuiRadio
                  sx={{
                    alignSelf: 'flex-start',
                    paddingTop: '6px',
                  }}
                />
              }
              label={
                <div
                  style={{
                    display: 'block',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    lineHeight: '1.5',
                    paddingTop: '6px',
                    paddingLeft: '0px',
                    marginTop: '0px',
                  }}
                  dangerouslySetInnerHTML={{
                    // we don't want inline html here - wraps label in a <p> tag
                    __html: contentToSanitizedHtml({
                      content: option.label,
                      inline: false,
                    }),
                  }}
                />
              }
              disabled={disabled}
              sx={{
                alignItems: 'flex-start',
                marginBottom: 1,
                '& .MuiFormControlLabel-label': {
                  display: 'block',
                  marginTop: '0px',
                  alignSelf: 'flex-start',
                  '& p': {
                    margin: 0,
                    padding: 0,
                  },
                  '& p:first-of-type': {
                    marginTop: 0,
                  },
                  '& p:last-of-type': {
                    marginBottom: 0,
                  },
                },
              }}
            />
          );

          for (let i = 0; i <= options.length; i++) {
            // Render "Other" at its position
            if (enableOtherOption && i === otherOptionPosition) {
              items.push(renderOtherOption());
            }
            // Render regular option
            if (optionIndex < options.length) {
              items.push(renderOption(options[optionIndex]));
              optionIndex++;
            }
          }

          return items;
        })()}
      </MuiRadioGroup>
    </>
  );
};

/**
 * Render the select as a dropdown component
 */
const DropDownWidget = ({
  displayValue,
  options,
  enableOtherOption,
  otherOptionPosition,
  handleChange,
  handleBlur,
  setOtherSelected,
  otherText,
  handleOtherTextChange,
  disabled,
}: WidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  // ref to the select element for programmatic closing
  const selectRef = useRef<HTMLDivElement>(null);

  // match types with the main event handler
  const localChangeHandler = (
    event: SelectChangeEvent<typeof displayValue>
  ) => {
    handleChange(event as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <MuiSelect
      ref={selectRef}
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      onChange={localChangeHandler}
      value={displayValue}
      input={<OutlinedInput />}
      disabled={disabled}
      onBlur={handleBlur}
      renderValue={selected => {
        // Get either the 'other' text or the value and
        // render as markdown before displaying
        let value = selected === OTHER_MARKER ? otherText || 'Other' : selected;
        const option = options.find(opt => opt.value === selected);
        if (option) {
          value = option.label;
        }
        return (
          <span
            dangerouslySetInnerHTML={{
              __html: contentToSanitizedHtml({
                content: value,
                inline: true,
              }),
            }}
          />
        );
      }}
    >
      {/* Render options and "Other" in correct order */}
      {(() => {
        const items: React.ReactNode[] = [];
        let optionIndex = 0;

        // Render the "Other" option MenuItem
        const renderOtherMenuItem = () => (
          <MenuItem
            key="__other__"
            value={OTHER_MARKER}
            sx={{
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              display: 'block',
              padding: '8px 16px',
            }}
            onKeyDown={e => e.stopPropagation()}
          >
            <TextField
              size="small"
              placeholder="Other"
              value={otherText}
              onChange={e => {
                e.stopPropagation();
                setOtherSelected(true);
                handleOtherTextChange(e.target.value);
              }}
              onBlur={e => {
                e.stopPropagation();
                handleOtherTextChange(otherText);
              }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onFocus={e => e.stopPropagation()}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleOtherTextChange(otherText);
                  setIsOpen(false);
                }
              }}
              disabled={disabled}
              variant="standard"
              multiline
              fullWidth
              slotProps={{
                htmlInput: {
                  maxLength: INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH,
                },
              }}
              sx={{
                ...otherTextFieldSx,
                '& .MuiInput-input': {
                  ...((otherTextFieldSx as any)['& .MuiInput-input'] || {}),
                  padding: '4px 0',
                },
              }}
            />
          </MenuItem>
        );

        // Render a regular option MenuItem
        const renderOptionMenuItem = (option: any) => (
          <MenuItem
            key={option.key ? option.key : option.value}
            value={option.value}
            sx={{
              whiteSpace: 'normal',
              wordWrap: 'break-word',
            }}
          >
            <ListItemText
              primary={
                <span
                  style={{
                    display: 'contents',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    lineHeight: '0.1rem',
                  }}
                  dangerouslySetInnerHTML={{
                    // generate inline html for the option label
                    __html: contentToSanitizedHtml({
                      content: option.label,
                      inline: true,
                    }),
                  }}
                />
              }
            />
          </MenuItem>
        );

        for (let i = 0; i <= options.length; i++) {
          // Render "Other" at its position
          if (enableOtherOption && i === otherOptionPosition) {
            items.push(renderOtherMenuItem());
          }
          // Render regular option
          if (optionIndex < options.length) {
            items.push(renderOptionMenuItem(options[optionIndex]));
            optionIndex++;
          }
        }

        return items;
      })()}
    </MuiSelect>
  );
};

// ============================================================================
// Value Schema
// ============================================================================

const valueSchema = (props: RadioGroupFieldProps) => {
  const optionValues = props.ElementProps.options.map(option => option.value);
  const enableOtherOption = props.ElementProps.enableOtherOption ?? false;

  // Bounded to stop maliciously long "Other" values
  let schema = z
    .string({error: 'Please select an option'})
    .max(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH, {
      message: `Must be at most ${INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH} characters`,
    });

  if (props.required) {
    schema = schema.min(1, {message: 'Please select an option'});
  }

  if (optionValues.length === 0) {
    return schemaWithAbsent('', schema);
  }

  const checked = schema.refine(
    value => {
      if (!props.required && value === '') return true;
      if (optionValues.includes(value)) return true;
      // accept any "Other: " value, even if empty
      if (enableOtherOption && value.startsWith(OTHER_PREFIX)) return true;
      return false;
    },
    {message: 'Please select an option'}
  );

  return schemaWithAbsent('', checked);
};

// ============================================================================
// Field Registration
// ============================================================================

export const radioGroupFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'RadioGroup',
  returns: 'faims-core::String',
  component: RadioGroup,
  fieldPropsSchema: RadioGroupFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};

// We also register this as the 'Select' field for backward
// compatibility.  Select and RadioGroup are now merged into a
// single field type.
export const selectFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'Select',
  returns: 'faims-core::String',
  component: RadioGroup,
  fieldPropsSchema: RadioGroupFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
