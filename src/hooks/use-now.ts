import { useEffect, useState } from 'react';

/**
 * Ticking clock for live UI (stopwatch-style countdowns). Returns a fresh
 * `Date` every `intervalMs` and cleans up on unmount. Keep the state close
 * to the component that renders it so a 1-second tick re-renders as little
 * as possible.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
