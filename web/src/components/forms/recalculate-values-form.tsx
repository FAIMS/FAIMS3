import {useAuth} from '@/context/auth-provider';
import {Route} from '@/routes/_protected/projects/$projectId';
import {RefreshDerivedValuesSummary} from '@faims3/data-model';
import {useState} from 'react';
import {Button} from '../ui/button';
import {config} from '@/constants';

type RunState =
  | {phase: 'idle'}
  | {phase: 'running'}
  | {phase: 'done'; summary: RefreshDerivedValuesSummary}
  | {phase: 'error'};

/**
 * RecalculateValuesForm triggers the server-side refresh of values derived
 * from parent records (#2245) and displays the resulting summary. The same
 * refresh also runs automatically before every export; this button covers
 * checking or updating values without exporting.
 */
const RecalculateValuesForm = () => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const [state, setState] = useState<RunState>({phase: 'idle'});

  const run = async () => {
    if (!user) return;
    setState({phase: 'running'});
    try {
      const response = await fetch(
        `${config.apiUrl}/api/notebooks/${projectId}/refresh-derived-values`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (!response.ok) {
        setState({phase: 'error'});
        return;
      }
      const summary = (await response.json()) as RefreshDerivedValuesSummary;
      setState({phase: 'done', summary});
    } catch {
      setState({phase: 'error'});
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Some fields show values copied or calculated from a record's parent.
        These update when a record is next opened, so records not opened since
        their parent changed can hold outdated values. Recalculating brings
        every record up to date now. Note that records edited on a device but
        not yet synced are updated once they sync, through the usual conflict
        handling.
      </p>

      {state.phase === 'done' && (
        <p className="text-sm">
          Checked {state.summary.recordsExamined} record
          {state.summary.recordsExamined === 1 ? '' : 's'}; updated{' '}
          {state.summary.recordsUpdated}
          {state.summary.recordsFailed > 0 &&
            `; ${state.summary.recordsFailed} could not be updated`}
          .
        </p>
      )}
      {state.phase === 'error' && (
        <p className="text-sm text-destructive">
          Recalculation failed. Please try again; if the problem persists,
          contact support.
        </p>
      )}

      <Button
        onClick={run}
        disabled={state.phase === 'running'}
        className="w-fit"
      >
        {state.phase === 'running'
          ? 'Recalculating...'
          : state.phase === 'done'
            ? 'Recalculate again'
            : 'Recalculate values'}
      </Button>
    </div>
  );
};

export default RecalculateValuesForm;
