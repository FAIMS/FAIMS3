import {useEffect, useState} from 'react';

export function usePromise<Return, Initial, Args extends []>(
  initial: Initial,
  getter: (...args: Args) => Promise<Return> | Return,
  ...args: Args
):
  | {value: Initial | Return; setValue: (value: Initial | Return) => void}
  | {error: {}; resetError: () => void} {
  const [state, setState] = useState<{value: Return | Initial} | {error: {}}>({
    value: initial,
  });

  const resetError = () =>
    'value' in state ? undefined : setState({value: initial});

  const setValue = (val: Return | Initial) =>
    'error' in state ? undefined : setState({value: val});

  let unmounted = false;

  useEffect(() => {
    Promise.resolve(getter(...args))
      .then((retval: Return) => {
        if (!unmounted) {
          setState({value: retval});
        }
      })
      .catch((err: {}) => {
        setState({error: err});
      });
    return () => {
      unmounted = true;
    };
  }, []);

  if ('error' in state) {
    return {error: state.error, resetError: resetError};
  }

  if ('value' in state) {
    return {value: state.value, setValue: setValue};
  }

  throw Error('UNREACHABLE STATE');
}
