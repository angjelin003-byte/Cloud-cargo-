'use client';

import { memo, useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

let cachedTimeFormatter: Intl.DateTimeFormat | null = null;
let cachedDateTimeFormatter: Intl.DateTimeFormat | null = null;

function getTimeFormatter(): Intl.DateTimeFormat {
  if (!cachedTimeFormatter) {
    cachedTimeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return cachedTimeFormatter;
}

function getDateTimeFormatter(): Intl.DateTimeFormat {
  if (!cachedDateTimeFormatter) {
    cachedDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return cachedDateTimeFormatter;
}

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

const UTC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatUtcFallback(iso: string, mode: 'time' | 'datetime'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  if (mode === 'time') {
    return `${hh}:${mm} UTC`;
  }
  const mon = UTC_MONTHS[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${mon} ${day}, ${hh}:${mm} UTC`;
}

export const FormattedTime = memo(function FormattedTime({
  iso,
  mode = 'time',
}: FormattedTimeProps) {
  const hydrated = useIsHydrated();

  if (!hydrated) {
    return <>{formatUtcFallback(iso, mode)}</>;
  }

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return <>{iso}</>;
  }

  if (mode === 'datetime') {
    return <>{getDateTimeFormatter().format(d)}</>;
  }

  return <>{getTimeFormatter().format(d)}</>;
});
