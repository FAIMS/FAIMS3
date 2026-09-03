import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {
  NotebookViewTabProvider,
  useNotebookTab,
  usePlanTab,
} from './notebookViewTab';

const {routeParams} = vi.hoisted(() => ({
  routeParams: {current: {} as {planId?: string}},
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useParams: () => routeParams.current,
}));

/** Reports the tab it is on, and moves on demand. */
const TabConsumer = ({
  name,
  useTab,
}: {
  name: string;
  useTab: typeof useNotebookTab;
}) => {
  const tab = useTab();
  return (
    <>
      <span data-testid={name}>{tab.current ?? 'none'}</span>
      <button onClick={() => tab.select(`${name}-tab`)}>move {name}</button>
    </>
  );
};

/**
 * The notebook route: the tabs stand above whatever screen is nested under it,
 * so opening a record swaps the screen out and back.
 */
const Notebook = ({planId}: {planId?: string}) => {
  routeParams.current = {planId};
  const [isRecordOpen, setRecordOpen] = useState(false);
  return (
    <NotebookViewTabProvider>
      <button onClick={() => setRecordOpen(open => !open)}>
        toggle record
      </button>
      {isRecordOpen ? (
        <span>a record</span>
      ) : (
        <>
          <TabConsumer name="notebook" useTab={useNotebookTab} />
          <TabConsumer name="plan" useTab={usePlanTab} />
        </>
      )}
    </NotebookViewTabProvider>
  );
};

describe('NotebookViewTabProvider', () => {
  it('leaves the tab standing while a record screen is open', async () => {
    render(<Notebook planId="lab" />);
    await userEvent.click(screen.getByRole('button', {name: 'move notebook'}));
    await userEvent.click(screen.getByRole('button', {name: 'toggle record'}));
    await userEvent.click(screen.getByRole('button', {name: 'toggle record'}));
    expect(screen.getByTestId('notebook')).toHaveTextContent('notebook-tab');
  });

  it("keeps a plan's tab out of the notebook's own", async () => {
    render(<Notebook planId="lab" />);
    await userEvent.click(screen.getByRole('button', {name: 'move plan'}));
    expect(screen.getByTestId('plan')).toHaveTextContent('plan-tab');
    expect(screen.getByTestId('notebook')).toHaveTextContent('none');
  });

  it("starts a plan's tab over when the plan on screen changes", async () => {
    const {rerender} = render(<Notebook planId="lab" />);
    await userEvent.click(screen.getByRole('button', {name: 'move plan'}));
    await userEvent.click(screen.getByRole('button', {name: 'move notebook'}));
    rerender(<Notebook planId="field" />);
    // A slug from one plan means nothing in the next, but the notebook's own
    // view is the same view either way
    expect(screen.getByTestId('plan')).toHaveTextContent('none');
    expect(screen.getByTestId('notebook')).toHaveTextContent('notebook-tab');
  });

  it('refuses to serve a screen outside the notebook route', () => {
    // React logs the error it re-throws, which is noise the test expects
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn());
    expect(() =>
      render(<TabConsumer name="notebook" useTab={useNotebookTab} />)
    ).toThrow(/NotebookViewTabProvider/);
    consoleError.mockRestore();
  });
});
