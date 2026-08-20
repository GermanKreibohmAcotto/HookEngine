import type { DeliveryStatus } from '../api/types';

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'pendiente',
  delivering: 'entregando',
  succeeded: 'exitosa',
  failed: 'fallida',
  dead: 'muerta',
};
