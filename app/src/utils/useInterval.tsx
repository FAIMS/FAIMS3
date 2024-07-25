import * as React from 'react';

const {useEffect, useRef} = React;

type IntervalFunction = () => unknown | void;

export function useInterval(callback: IntervalFunction, delay: number) {
  /**
   * Typescript version of Dan Abramov's useInterval requiring non-null value for delay
   * Credit: https://gist.github.com/babakness/faca3b633bc23d9a0924efb069c9f1f5
   */
  const savedCallback = useRef<IntervalFunction | null>(null);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  });

  // Set up the interval.
  useEffect(() => {
    function tick() {
      if (savedCallback.current !== null) {
        savedCallback.current();
      }
    }
    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
