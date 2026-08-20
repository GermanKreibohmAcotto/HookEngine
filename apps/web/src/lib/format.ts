const msFormatter = new Intl.NumberFormat('es', { maximumFractionDigits: 0 });
const secondsFormatter = new Intl.NumberFormat('es', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat('es', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000
    ? `${msFormatter.format(Math.round(ms))} ms`
    : `${secondsFormatter.format(ms / 1000)} s`;
}

export function formatPercent(rate: number | null): string {
  if (rate === null) return '—';
  return percentFormatter.format(rate);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es');
}
