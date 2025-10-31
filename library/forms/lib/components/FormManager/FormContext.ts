// Defines the context handler for form state management

import React, {useState} from 'react';

export interface FormContextType {
  setValue: (fieldName: string, value: any) => void;
  getValue: (fieldName: string) => any;
}

export const FormContext = React.createContext<FormContextType | null>(null);

// Hook for use in fields to get the current field value and a value setter
export const useFormField = (fieldName: string) => {
  const context = React.useContext(FormContext);
  if (!context) {
    throw new Error('useFormField must be used within FormManager');
  }
  // get only the specific field value to avoid re-renders on other field changes
  const [localValue, setLocalValue] = useState(() =>
    context.getValue(fieldName)
  );

  // Return only the specific field value and setter
  // This is key for preventing unnecessary re-renders
  return {
    value: localValue,
    setValue: React.useCallback(
      (value: any) => {
        setLocalValue(value);
        context.setValue(fieldName, value);
      },
      [fieldName, context.setValue]
    ),
  };
};
