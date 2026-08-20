import { CheckCircle2, CircleAlert, Globe, XCircle } from 'lucide-react';
import { useState } from 'react';

import { useDelivery, useDeliveries } from '../api/hooks/useDeliveries';
import { useMetrics } from '../api/hooks/useMetrics';
import type { DeliveryStatus } from '../api/types';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { FilterChips } from '../components/ui/FilterChips';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { PayloadViewer } from '../components/ui/PayloadViewer';
import { Spinner } from '../components/ui/Spinner';
import { StatTile } from '../components/ui/StatTile';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDateTime, formatMs, formatPercent } from '../lib/format';
import { STATUS_LABELS } from '../lib/statusLabels';

const countFormatter = new Intl.NumberFormat('es');

const STATUS_OPTIONS: Array<{ value: DeliveryStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'succeeded', label: STATUS_LABELS.succeeded },
  { value: 'failed', label: STATUS_LABELS.failed },
  { value: 'dead', label: STATUS_LABELS.dead },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'delivering', label: STATUS_LABELS.delivering },
];

function DeliveryDetailModal({ deliveryId, onClose }: { deliveryId: string; onClose: () => void }) {
  const { data: delivery, isLoading } = useDelivery(deliveryId);

  return (
    <Modal title="Detalle de la entrega" onClose={onClose}>
      {isLoading || !delivery ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                Evento
              </div>
              <div className="text-on-surface">{delivery.event.eventType}</div>
            </div>
            <div>
              <div className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                Suscriptor
              </div>
              <div className="text-on-surface">{delivery.subscriber.name}</div>
            </div>
            <div>
              <div className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                Estado
              </div>
              <StatusBadge status={delivery.status} />
            </div>
            <div>
              <div className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                Intentos
              </div>
              <div className="text-on-surface">{delivery.attemptCount}</div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
              Payload
            </h3>
            <PayloadViewer value={delivery.event.payload} />
          </div>

          <div>
            <h3 className="mb-2 font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
              Línea de tiempo de intentos
            </h3>
            {delivery.attempts.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                Todavía no hay intentos registrados.
              </p>
            ) : (
              <ol className="space-y-2 border-l border-outline-variant/20 pl-4">
                {delivery.attempts.map((attempt) => (
                  <li key={attempt.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-outline-variant" />
                    <div className="flex items-center gap-2">
                      <span className="font-label-md text-label-md text-on-surface">
                        #{attempt.attemptNumber}
                      </span>
                      {attempt.responseStatus !== null && (
                        <span className="text-on-surface-variant">
                          HTTP {attempt.responseStatus}
                        </span>
                      )}
                      <span className="text-on-surface-variant">
                        {formatMs(attempt.latencyMs)}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant/60">
                        {formatDateTime(attempt.attemptedAt)}
                      </span>
                    </div>
                    {attempt.errorMessage && (
                      <p className="mt-0.5 font-body-sm text-body-sm text-warning">
                        {attempt.errorMessage}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function DeliveriesPage() {
  const [status, setStatus] = useState<DeliveryStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useDeliveries({ status: status === 'all' ? undefined : status });
  const { data: metrics } = useMetrics(60);

  const windowTotal = metrics
    ? Object.values(metrics.byStatus).reduce((sum, count) => sum + count, 0)
    : 0;
  const rateOf = (count: number): number | null => (windowTotal === 0 ? null : count / windowTotal);

  return (
    <div className="space-y-section-margin">
      <PageHeader
        title="Registro de entregas"
        subtitle="Monitoreá el estado y rendimiento de los envíos de webhooks hacia los suscriptores."
      />

      {metrics && (
        <div className="grid grid-cols-2 gap-card-gap sm:grid-cols-4">
          <StatTile
            label="Entregas (60 min)"
            value={countFormatter.format(windowTotal)}
            icon={Globe}
          />
          <StatTile label="Exitosas" value={formatPercent(metrics.successRate)} icon={CheckCircle2} />
          <StatTile
            label="Fallidas"
            value={formatPercent(rateOf(metrics.byStatus.failed ?? 0))}
            icon={CircleAlert}
          />
          <StatTile
            label="Muertas (DLQ)"
            value={formatPercent(rateOf(metrics.byStatus.dead ?? 0))}
            icon={XCircle}
          />
        </div>
      )}

      <Card>
        <div className="mb-4">
          <FilterChips options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </div>

        {isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-4 text-center font-body-md text-body-md text-on-surface-variant">
            Ninguna entrega coincide con este filtro.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10 font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                <th className="py-2 pr-4 font-medium">Evento</th>
                <th className="py-2 pr-4 font-medium">Suscriptor</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Intentos</th>
                <th className="py-2 pr-4 font-medium">Creada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {data.items.map((item) => (
                <tr
                  key={item.deliveryId}
                  onClick={() => setSelectedId(item.deliveryId)}
                  className="cursor-pointer hover:bg-surface-container-high/50"
                >
                  <td className="py-3 pr-4 text-on-surface">{item.event.eventType}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={item.subscriber.name} />
                      <span className="text-on-surface-variant">{item.subscriber.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">{item.attemptCount}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">
                    {formatDateTime(item.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && (
          <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
            Mostrando {data.items.length} de {data.total}
          </p>
        )}
      </Card>

      {selectedId && (
        <DeliveryDetailModal deliveryId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
