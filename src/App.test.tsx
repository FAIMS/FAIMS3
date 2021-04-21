import React from 'react';
import {render, screen} from '@testing-library/react';
import App from './App';

test('renders form', () => {
  render(<App />);
  const linkElement = screen.getByText(/is the current project/i);
  //expect(linkElement).toBeInTheDocument();
});
