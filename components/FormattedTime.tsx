'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface FormattedTimeProps {
  iso: string;
  mode?: 'time' | 'datetime';
}

function formatUtcFallback(iso: string, mode: 'time' | 'datetime'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  if (mode === 'time') {
    return `${hh}:${mm} UTC`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${mon} ${day}, ${hh}:${mm} UTC`;
}

export function FormattedTime({ iso, mode = 'time' }: FormattedTimeProps) {
  const hydrated = useIsHydrated();

  if (!hydrated) {
    return <>{formatUtcFallback(iso, mode)}</>;
  }

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return <>{iso}</>;
  }

  if (mode === 'datetime') {
    return (
      <>
        {d.toLocaleString([], {
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </>
    );
  }

  return (
    <>
      {d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}
    </>
  );
}
