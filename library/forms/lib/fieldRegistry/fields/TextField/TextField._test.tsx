import '@testing-library/jest-dom/vitest';

// TODO fix this up to mock tanstack forms properly

// Mock Tanstack Forms field interface
//const createMockField = (initialValue: string = '') => {
//  let value = initialValue;
//
//  return {
//    state: {
//      value,
//      meta: {
//        errors: [],
//        errorMap: {},
//        isDirty: false,
//        isTouched: false,
//        isPristine: true,
//        isValidating: false,
//        touchedErrors: [],
//      },
//    },
//    handleChange: vi.fn((newValue: string) => {
//      value = newValue;
//    }),
//    handleBlur: vi.fn(),
//  };
//};
//
//const renderTextField = (props: any, field?: any) => {
//  const mockField = field || createMockField();
//
//  return {
//    ...render(
//      React.createElement(textFieldSpec.component, {
//        ...props,
//        field: mockField,
//      })
//    ),
//    mockField,
//  };
//};
//
//describe('TextField', () => {
//  it('renders an input field', () => {
//    renderTextField({name: 'test-field', label: 'Test Field'});
//
//    const input = screen.getByRole('textbox');
//    expect(input).toBeInTheDocument();
//  });
//
//  it('displays the label', () => {
//    renderTextField({name: 'test-field', label: 'Full Name'});
//
//    expect(screen.getByText('Full Name')).toBeInTheDocument();
//  });
//
//  it('accepts text input', async () => {
//    const user = userEvent.setup();
//    renderTextField({name: 'test-field', label: 'Test Field'});
//
//    const input = screen.getByRole('textbox');
//    await user.type(input, 'Hello World');
//
//    expect(input).toHaveValue('Hello World');
//  });
//
//  it('calls handleChange when input changes', async () => {
//    const user = userEvent.setup();
//    const {mockField} = renderTextField({
//      name: 'test-field',
//      label: 'Test Field',
//    });
//
//    const input = screen.getByRole('textbox');
//    await user.type(input, 'Test');
//
//    // Should be called for each character typed
//    expect(mockField.handleChange).toHaveBeenCalled();
//    expect(mockField.handleChange).toHaveBeenCalledWith(expect.any(String));
//  });
//
//  it('calls handleBlur when input loses focus', async () => {
//    const user = userEvent.setup();
//    const {mockField} = renderTextField({
//      name: 'test-field',
//      label: 'Test Field',
//    });
//
//    const input = screen.getByRole('textbox');
//    await user.click(input);
//    await user.tab();
//
//    expect(mockField.handleBlur).toHaveBeenCalled();
//  });
//
//  it('loads initial value from field state', () => {
//    const mockField = createMockField('Initial Value');
//    renderTextField({name: 'test-field', label: 'Test Field'}, mockField);
//
//    const input = screen.getByRole('textbox');
//    expect(input).toHaveValue('Initial Value');
//  });
//
//  it('handles empty initial value', () => {
//    renderTextField({name: 'test-field', label: 'Test Field'});
//
//    const input = screen.getByRole('textbox');
//    expect(input).toHaveValue('');
//  });
//
//  it('handles null initial value', () => {
//    const mockField = {
//      state: {value: null},
//      handleChange: vi.fn(),
//      handleBlur: vi.fn(),
//    };
//    renderTextField({name: 'test-field', label: 'Test Field'}, mockField);
//
//    const input = screen.getByRole('textbox');
//    expect(input).toHaveValue('');
//  });
//
//  it('updates value on multiple changes', async () => {
//    const user = userEvent.setup();
//    renderTextField({name: 'test-field', label: 'Test Field'});
//
//    const input = screen.getByRole('textbox');
//
//    await user.type(input, 'First');
//    expect(input).toHaveValue('First');
//
//    await user.clear(input);
//    await user.type(input, 'Second');
//    expect(input).toHaveValue('Second');
//  });
//
//  it('displays helper text when provided', () => {
//    renderTextField({
//      name: 'test-field',
//      label: 'Test Field',
//      advancedHelperText: 'Enter your full name',
//    });
//
//    expect(screen.getByTestId('advanced-help')).toBeInTheDocument();
//  });
//
//  it('shows required indicator when required is true', () => {
//    renderTextField({
//      name: 'test-field',
//      label: 'Test Field',
//      required: true,
//    });
//
//    expect(screen.getByTestId('required-indicator')).toBeInTheDocument();
//  });
//
//  it('does not show required indicator when required is false', () => {
//    renderTextField({
//      name: 'test-field',
//      label: 'Test Field',
//      required: false,
//    });
//
//    expect(screen.queryByTestId('required-indicator')).not.toBeInTheDocument();
//  });
//
//  it('handles special characters in input', async () => {
//    const user = userEvent.setup();
//    renderTextField({name: 'test-field', label: 'Test Field'});
//
//    const input = screen.getByRole('textbox');
//    const specialText = '!@#$%^&*()_+-=[{}]|:;"<>?,./';
//
//    // need to double [ and { for userEvent.type
//    await user.type(input, specialText.replace('[', '[[').replace('{', '{{'));
//    expect(input).toHaveValue(specialText);
//  });
//
//  it('handles unicode characters', async () => {
//    const user = userEvent.setup();
//    renderTextField({name: 'test-field', label: 'Test Field'});
//
//    const input = screen.getByRole('textbox');
//    await user.type(input, '你好世界 🌍');
//
//    expect(input).toHaveValue('你好世界 🌍');
//  });
//});
//
//describe('TextField validator', () => {
//  it('validates string values as valid', () => {
//    expect(textFieldSpec.valueSchemaFunction).toBeDefined();
//
//    const schema = textFieldSpec.valueSchemaFunction!({});
//
//    expect(schema.safeParse('hello').success).toBe(true);
//    expect(schema.safeParse('').success).toBe(true);
//    expect(schema.safeParse('123').success).toBe(true);
//  });
//
//  it('validates non-string values as invalid', () => {
//    const schema = textFieldSpec.valueSchemaFunction!({});
//
//    expect(schema.safeParse(123).success).toBe(false);
//    expect(schema.safeParse(null).success).toBe(false);
//    expect(schema.safeParse(undefined).success).toBe(false);
//    expect(schema.safeParse({}).success).toBe(false);
//    expect(schema.safeParse([]).success).toBe(false);
//  });
//});
//
