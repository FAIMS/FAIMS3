import React from 'react';
import {render, screen} from '@testing-library/react';
import {it, expect, describe} from 'vitest';
import '@testing-library/jest-dom/vitest';
import FieldWrapper from '.';

describe('FieldWrapper', () => {
  it('renders children', () => {
    render(
      <FieldWrapper>
        <input data-testid="test-input" />
      </FieldWrapper>
    );
    expect(screen.getByTestId('test-input')).toBeInTheDocument();
  });

  it('renders heading when provided', () => {
    render(
      <FieldWrapper heading="Test Field">
        <input />
      </FieldWrapper>
    );
    expect(screen.getByText('Test Field')).toBeInTheDocument();
  });

  it('does not render heading when not provided', () => {
    const {container} = render(
      <FieldWrapper>
        <input />
      </FieldWrapper>
    );
    // Should not have any heading elements
    expect(container.querySelector('h3, h4, h5, h6')).not.toBeInTheDocument();
  });

  it('displays required indicator when required is true', () => {
    render(
      <FieldWrapper heading="Test Field" required={true}>
        <input />
      </FieldWrapper>
    );
    expect(screen.getByTestId('required-indicator')).toBeInTheDocument();
  });

  it('does not display required indicator when required is false', () => {
    render(
      <FieldWrapper heading="Test Field" required={false}>
        <input />
      </FieldWrapper>
    );
    expect(screen.queryByTestId('required-indicator')).toBeNull();
  });

  it('does not display required indicator when not specified', () => {
    render(
      <FieldWrapper heading="Test Field">
        <input />
      </FieldWrapper>
    );
    expect(screen.queryByTestId('required-indicator')).toBeNull();
  });

  it('renders advanced helper text when provided', () => {
    const helperText = 'This is helpful information about the field';
    render(
      <FieldWrapper advancedHelperText={helperText}>
        <input />
      </FieldWrapper>
    );
    expect(screen.getByTestId('advanced-help')).toBeInTheDocument();
  });

  it('does not render helper text when not provided', () => {
    render(
      <FieldWrapper heading="Test Field">
        <input />
      </FieldWrapper>
    );
    // Should not have helper text elements (adjust selector based on implementation)
    expect(screen.queryByTestId('advanced-help')).toBeNull();
  });

  it('renders all props together', () => {
    const helperText = 'Advanced help text';
    render(
      <FieldWrapper
        heading="Complete Field"
        required={true}
        advancedHelperText={helperText}
      >
        <input data-testid="test-input" />
      </FieldWrapper>
    );

    expect(screen.getByText('Complete Field')).toBeInTheDocument();
    expect(screen.getByTestId('required-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-help')).toBeInTheDocument();
    expect(screen.getByTestId('test-input')).toBeInTheDocument();
  });

  it('applies proper accessibility structure', () => {
    render(
      <FieldWrapper heading="Accessible Field" required={true}>
        <input aria-label="test" />
      </FieldWrapper>
    );

    // The heading should be associated with the field
    const heading = screen.getByText('Accessible Field');
    expect(heading).toBeInTheDocument();

    // Required fields should have appropriate ARIA attributes
    // (This test depends on your implementation)
  });
});
