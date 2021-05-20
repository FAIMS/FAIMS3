import React from 'react';
import {render, screen} from '@testing-library/react';
import App from './App';

// No projects created or to be created during init.
jest.mock('./sync/index', () => ({
  initialize: () => Promise.resolve(),
  add_initial_listener: (
    registering_func: (initialEvents: unknown) => unknown
  ) =>
    registering_func({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      on: (_event_name: string, ..._args: unknown[]) => {},
    }),
}));

test('renders app', () => {
  render(<App />);
  const linkElement = screen.getByText(/FAIMS3/i);
  expect(linkElement).toBeInTheDocument();
});
