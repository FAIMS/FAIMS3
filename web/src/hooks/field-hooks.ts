import { useCallback, useState } from "react";

/**
 * Hook for limiting text field input length and exposing validation error text.
 *
 * @param fieldLabel - Display name used in the error message.
 * @param defaultMaxLength - Optional default maximum length. If undefined, no length limit is applied.
 *
 * @returns errorText - Current validation error message, or undefined if valid.
 * @returns validateAndUpdate - Checks/slices the input value, then calls onValid with the allowed value.
 */
export const useTextFieldLengthLimit = (
    fieldLabel = 'Text field input',
    maxLength?: number
) => {
    const [errorText, setErrorText] = useState<string>();

    const validateAndUpdate = useCallback(
        (
            value: string | number | boolean,
            onValid: (validValue: string) => void,
        ) => {
            if (typeof value !== 'string') return;

            // If maxLength is undefined, save/update with the original value.
            if (maxLength === undefined) {
                setErrorText(undefined);
                onValid(value);
                return;
            }

            // Only the first maxLength characters will be saved/updated.
            const slicedValue = value.slice(0, maxLength);

            if (value.length > maxLength) {
                setErrorText(
                    `${fieldLabel} must be ${maxLength} characters or less. Only the first ${maxLength} characters will be saved.`
                );
            } else {
                setErrorText(undefined);
            }

            onValid(slicedValue);
        },
        [maxLength, fieldLabel]
    );

    return {
        errorText,
        validateAndUpdate,
    };
};