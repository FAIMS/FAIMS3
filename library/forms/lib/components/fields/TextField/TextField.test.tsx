import React from 'react';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {it, expect, describe, vi} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {textFieldSpec} from '.';
import {FormContext} from '../../FormManager/FormContext';

// Mock form context for testing
const createMockContext = (initialValue: any = '') => {
  const values: Record<string, any> = {
    'test-field': initialValue,
  };

  return {
    setValue: vi.fn((fieldName: string, value: any) => {
      values[fieldName] = value;
    }),
    getValue: vi.fn((fieldName: string) => values[fieldName]),
  };
};

const renderTextField = (props: any, contextValue?: any) => {
  const mockContext = contextValue || createMockContext();

  return {
    ...render(
      <FormContext.Provider value={mockContext}>
        {React.createElement(textFieldSpec.component, props)}
      </FormContext.Provider>
    ),
    mockContext,
  };
};

describe('TextField', () => {
  it('renders an input field', () => {
    renderTextField({name: 'test-field', label: 'Test Field'});

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('displays the label', () => {
    renderTextField({name: 'test-field', label: 'Full Name'});

    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('accepts text input', async () => {
    const user = userEvent.setup();
    renderTextField({name: 'test-field', label: 'Test Field'});

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello World');

    expect(input).toHaveValue('Hello World');
  });

  it('calls setValue when input changes', async () => {
    const user = userEvent.setup();
    const {mockContext} = renderTextField({
      name: 'test-field',
      label: 'Test Field',
    });

    const input = screen.getByRole('textbox');
    await user.type(input, 'Test');

    // Should be called for each character typed
    expect(mockContext.setValue).toHaveBeenCalled();
    expect(mockContext.setValue).toHaveBeenCalledWith(
      'test-field',
      expect.any(String)
    );
  });

  it('loads initial value from form context', () => {
    const mockContext = createMockContext('Initial Value');
    renderTextField({name: 'test-field', label: 'Test Field'}, mockContext);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Initial Value');
  });

  it('handles empty initial value', () => {
    renderTextField({name: 'test-field', label: 'Test Field'});

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });

  it('updates value on multiple changes', async () => {
    const user = userEvent.setup();
    renderTextField({name: 'test-field', label: 'Test Field'});

    const input = screen.getByRole('textbox');

    await user.type(input, 'First');
    expect(input).toHaveValue('First');

    await user.clear(input);
    await user.type(input, 'Second');
    expect(input).toHaveValue('Second');
  });

  it('displays helper text when provided', () => {
    renderTextField({
      name: 'test-field',
      label: 'Test Field',
      advancedHelperText: 'Enter your full name',
    });

    expect(screen.getByTestId('advanced-help')).toBeInTheDocument();
  });

  it('shows required indicator when required is true', () => {
    renderTextField({
      name: 'test-field',
      label: 'Test Field',
      required: true,
    });

    expect(screen.getByTestId('required-indicator')).toBeInTheDocument();
  });

  it('does not show required indicator when required is false', () => {
    renderTextField({
      name: 'test-field',
      label: 'Test Field',
      required: false,
    });

    expect(screen.queryByTestId('required-indicator')).not.toBeInTheDocument();
  });

  it('handles special characters in input', async () => {
    const user = userEvent.setup();
    renderTextField({name: 'test-field', label: 'Test Field'});

    const input = screen.getByRole('textbox');
    const specialText = '!@#$%^&*()_+-=[{}]|:;"<>?,./';

    // need to double [ and { for userEvent.type
    await user.type(input, specialText.replace('[', '[[').replace('{', '{{'));
    expect(input).toHaveValue(specialText);
  });

  it('handles unicode characters', async () => {
    const user = userEvent.setup();
    renderTextField({name: 'test-field', label: 'Test Field'});

    const input = screen.getByRole('textbox');
    await user.type(input, '你好世界 🌍');

    expect(input).toHaveValue('你好世界 🌍');
  });
});

describe('TextField validator', () => {
  it('validates string values as valid', () => {
    expect(textFieldSpec.validator('hello')).toBe(true);
    expect(textFieldSpec.validator('')).toBe(true);
    expect(textFieldSpec.validator('123')).toBe(true);
  });

  it('validates non-string values as invalid', () => {
    expect(textFieldSpec.validator(123)).toBe(false);
    expect(textFieldSpec.validator(null)).toBe(false);
    expect(textFieldSpec.validator(undefined)).toBe(false);
    expect(textFieldSpec.validator({})).toBe(false);
    expect(textFieldSpec.validator([])).toBe(false);
  });
});
