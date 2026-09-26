import '@testing-library/jest-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {FormBreadcrumbs} from './NavigationBreadcrumbs';
import {FullFormConfig} from '../types';

const config = {
  dataEngine: () => ({uiSpec: {viewsets: {Density: {label: 'Density'}}}}),
  navigation: {toRecord: vi.fn()},
} as unknown as FullFormConfig;

/** The breadcrumb trail of a record opened straight off a record list. */
const renderCrumbs = (navigateToRecordList: {
  label?: string;
  navigate: () => void;
}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FormBreadcrumbs
        currentFormId="Density"
        navigationContext={{mode: 'root'}}
        config={config}
        navigateToRecordList={navigateToRecordList}
      />
    </QueryClientProvider>
  );

afterEach(cleanup);

describe('the root crumb', () => {
  it('reads as the record list when the caller names nothing', () => {
    renderCrumbs({navigate: vi.fn()});
    expect(screen.getByText('Record list')).toBeInTheDocument();
  });

  it('reads as the wording the caller gives it', () => {
    renderCrumbs({label: 'Back to cell A1', navigate: vi.fn()});
    expect(screen.getByText('Back to cell A1')).toBeInTheDocument();
    expect(screen.queryByText('Record list')).not.toBeInTheDocument();
  });

  it('still leaves the form when clicked', async () => {
    const navigate = vi.fn();
    renderCrumbs({label: 'Back to cell A1', navigate});
    await userEvent.click(screen.getByText('Back to cell A1'));
    expect(navigate).toHaveBeenCalled();
  });
});
