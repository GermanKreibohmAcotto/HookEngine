import { useState } from 'react';

import { useDelivery, useDeliveries } from '../api/hooks/useDeliveries';
import type { DeliveryStatus } from '../api/types';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { PayloadViewer } from '../components/ui/PayloadViewer';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDateTime, formatMs } from '../lib/format';
import { STATUS_LABELS } from '../lib/statusLabels';

const STATUS_OPTIONS: Array<DeliveryStatus | 'all'> = [
  'all',
  'pending',
  'delivering',
  'succeeded',
  'failed',
  'dead',
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
              <div className="text-xs uppercase text-slate-500">Evento</div>
              <div className="text-slate-200">{delivery.event.eventType}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Suscriptor</div>
              <div className="text-slate-200">{delivery.subscriber.name}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Estado</div>
              <StatusBadge status={delivery.status} />
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Intentos</div>
              <div className="text-slate-200">{delivery.attemptCount}</div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Payload
            </h3>
            <PayloadViewer value={delivery.event.payload} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Línea de tiempo de intentos
            </h3>
            {delivery.attempts.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no hay intentos registrados.</p>
            ) : (
              <ol className="space-y-2 border-l border-slate-800 pl-4">
                {delivery.attempts.map((attempt) => (
                  <li key={attempt.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-slate-600" />
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">#{attempt.attemptNumber}</span>
                      {attempt.responseStatus !== null && (
                        <span className="text-slate-400">HTTP {attempt.responseStatus}</span>
                      )}
                      <span className="text-slate-500">{formatMs(attempt.latencyMs)}</span>
                      <span className="text-xs text-slate-600">
                        {formatDateTime(attempt.attemptedAt)}
                      </span>
                    </div>
                    {attempt.errorMessage && (
                      <p className="mt-0.5 text-xs text-amber-400">{attempt.errorMessage}</p>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Entregas</h1>
          <p className="text-sm text-slate-500">
            Cada intento que hizo HookEngine, en todos los suscriptores.
          </p>
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as DeliveryStatus | 'all')}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === 'all' ? 'Todos los estados' : STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Ninguna entrega coincide con este filtro.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Evento</th>
                <th className="py-2 pr-4 font-medium">Suscriptor</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Intentos</th>
                <th className="py-2 pr-4 font-medium">Creada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.items.map((item) => (
                <tr
                  key={item.deliveryId}
                  onClick={() => setSelectedId(item.deliveryId)}
                  className="cursor-pointer hover:bg-slate-800/50"
                >
                  <td className="py-2.5 pr-4 text-slate-200">{item.event.eventType}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{item.subscriber.name}</td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400">{item.attemptCount}</td>
                  <td className="py-2.5 pr-4 text-slate-500">{formatDateTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && (
          <p className="mt-3 text-xs text-slate-500">
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
