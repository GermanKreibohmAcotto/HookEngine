import type { DeliveryStatus } from '../../api/types';
import { STATUS_LABELS } from '../../lib/statusLabels';

const STYLES: Record<DeliveryStatus, string> = {
  pending: 'bg-outline-variant/10 text-on-surface-variant',
  delivering: 'bg-primary/10 text-primary',
  succeeded: 'bg-success/10 text-success',
  failed: 'bg-warning/10 text-warning',
  dead: 'bg-error/10 text-error',
};

const DOT_STYLES: Record<DeliveryStatus, string> = {
  pending: 'bg-outline-variant',
  delivering: 'bg-primary',
  succeeded: 'bg-success',
  failed: 'bg-warning',
  dead: 'bg-error',
};

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label-sm text-label-sm ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
