import { useCallback, useState } from 'react';

/**
 * Hook for limiting text field input length and exposing validation error text.
 *
 * Keeps the full typed value locally for display, but only passes the allowed
 * value to onValid when maxLength is set.
 *
 * @param initialValue - string, initial text shown in the input.
 * @param maxLength - number, maximum number of characters to save.
 *
 * @returns errorText - Current validation error message, or undefined if valid.
 * @returns inputValue - Full text shown in the input.
 * @returns validateAndUpdate - Updates the input value and calls onValid with the allowed value.
 */

const DEFAULT_MAX_LENGTH = 25

export const useTextFieldLengthLimit = (
    initialValue?: string,
    maxLength: number = DEFAULT_MAX_LENGTH,
) => {
    const [errorText, setErrorText] = useState<string>();

    // Keep a local input value so the field can show exactly what the user types.
    // Redux may store a sliced value, so using it directly could overwrite the input
    // and move the cursor to the end on re-render.
    const [inputValue, setInputValue] = useState<string>(initialValue ?? '');

    const validateAndUpdate = useCallback(
        (
            value: string,
            onValid: (validValue: string) => void
        ) => {
            // Update the displayed input value.
            setInputValue(value);

            if (typeof maxLength !== 'number' || maxLength < 0) {
                // No valid length limit, save whatever the user typed.
                setErrorText(undefined);
                onValid(value);
                return;
            }

            if (value.length > maxLength) {
                setErrorText(
                    `${value.length} / ${maxLength} characters. Only the first ${maxLength} characters will be saved.`
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