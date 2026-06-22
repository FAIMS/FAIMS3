import {useCallback, useState} from 'react';

/**
 * Hook for limiting text field input length and exposing validation error text.
 *
 * Keeps the full typed value locally for display, but only passes the allowed
 * value to onValid when maxLength is set.
 *
 * @param maxLength - number, maximum number of characters to save.
 * @param initialValue - string, optional, initial text shown in the input.
 *
 * @returns errorText - Current validation error message, or undefined if valid.
 * @returns inputValue - Full text shown in the input.
 * @returns validateAndUpdate - Updates the input value and calls onValid with the allowed value.
 */

export const useTextFieldLengthLimit = ({
  maxLength,
  initialValue,
}: {
  maxLength: number;
  initialValue?: string;
}) => {
  const [errorText, setErrorText] = useState<string>();

  // Keep a local input value so the field can show exactly what the user types.
  // Redux may store a sliced value, so using it directly could overwrite the input
  // and move the cursor to the end on re-render.
  const [inputValue, setInputValue] = useState<string>(initialValue ?? '');

  const validateAndUpdate = useCallback(
    (value: string, onValid: (validValue: string) => void) => {
      // Update the displayed input value.
      setInputValue(value);

      // No valid length limit, save whatever the user typed.
      if (typeof maxLength !== 'number' || maxLength < 0) {
        console.error(
          'Invalid maxLength value in useTextFieldLengthLimit: maxLength must be a positive integer.'
        );
        setErrorText(undefined);
        onValid(value);
        return;
      }

      if (value.length > maxLength) {
        setErrorText(
          `Maximum length exceeded (${value.length} / ${maxLength}). Extra characters will not be saved.`
        );
      } else {
        setErrorText(undefined);
      }
      // Only the first maxLength characters will be saved/updated.
      const slicedValue = value.slice(0, maxLength);
      onValid(slicedValue);
    },
    [maxLength]
  );

  return {
    errorText,
    inputValue,
    validateAndUpdate,
  };
};
