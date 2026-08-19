import type { DeliveryStatus } from '../../api/types';

const STYLES: Record<DeliveryStatus, string> = {
  pending: 'bg-slate-800 text-slate-300',
  delivering: 'bg-blue-950 text-blue-300',
  succeeded: 'bg-emerald-950 text-emerald-300',
  failed: 'bg-amber-950 text-amber-300',
  dead: 'bg-red-950 text-red-300',
};

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
