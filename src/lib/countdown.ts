import { useEffect, useState } from 'react';

/** "3d 8h left", "5h 12m left", "12m 30s left", "42s left", then "Now". */
export function formatCountdown(msLeft: number): string {
  if (msLeft < 1000) return 'Now';
  const total = Math.floor(msLeft / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

/** The current time, re-rendering the caller every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
