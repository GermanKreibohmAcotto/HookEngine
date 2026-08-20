import { Activity, CheckCircle2, Gauge, TriangleAlert } from 'lucide-react';

import { useMetrics } from '../api/hooks/useMetrics';
import { useDeliveryStream } from '../api/hooks/useDeliveryStream';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { StatTile } from '../components/ui/StatTile';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatMs, formatPercent } from '../lib/format';
import { STATUS_LABELS } from '../lib/statusLabels';
import type { DeliveryStatus } from '../api/types';

export function OverviewPage() {
  const { data: metrics, isLoading } = useMetrics(60);
  const { events, connected } = useDeliveryStream();

  return (
    <div className="space-y-section-margin">
      <PageHeader title="Resumen" subtitle="Últimos 60 minutos." />

      {isLoading || !metrics ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-card-gap sm:grid-cols-4">
            <StatTile label="Tasa de éxito" value={formatPercent(metrics.successRate)} icon={CheckCircle2} />
            <StatTile label="Latencia p50" value={formatMs(metrics.latencyMs.p50)} icon={Gauge} />
            <StatTile label="Latencia p95" value={formatMs(metrics.latencyMs.p95)} icon={Activity} />
            <StatTile label="Latencia p99" value={formatMs(metrics.latencyMs.p99)} icon={TriangleAlert} />
          </div>

          <div className="grid gap-card-gap md:grid-cols-2">
            <Card title="Entregas por estado">
              <div className="space-y-2">
                {Object.entries(metrics.byStatus).length === 0 && (
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    No hay entregas en esta ventana.
                  </p>
                )}
                {Object.entries(metrics.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3 text-sm">
                    <span className="w-24 font-body-sm text-body-sm text-on-surface-variant">
                      {STATUS_LABELS[status as DeliveryStatus]}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, (count / Math.max(1, Math.max(...Object.values(metrics.byStatus)))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right font-label-md text-label-md text-on-surface">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Códigos de respuesta">
              <div className="space-y-2">
                {Object.entries(metrics.statusCodeDistribution).length === 0 && (
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    No hay respuestas registradas en esta ventana.
                  </p>
                )}
                {Object.entries(metrics.statusCodeDistribution)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([code, count]) => (
                    <div key={code} className="flex items-center justify-between text-sm">
                      <span className="font-label-md text-label-md text-on-surface-variant">
                        {code}
                      </span>
                      <span className="font-label-md text-label-md text-on-surface">{count}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </>
      )}

      <Card
        title="Feed de entregas en vivo"
        action={
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-primary' : 'bg-outline-variant'}`}
          />
        }
      >
        {events.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">
            Esperando actividad de entregas — dispará un evento y va a aparecer acá.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {events.map((event, index) => (
              <li
                key={`${event.deliveryId}-${event.attemptNumber}-${index}`}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={event.status} />
                  <span className="font-label-md text-label-md text-on-surface">
                    {event.eventType}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    → {event.subscriberName}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-body-sm text-body-sm text-on-surface-variant">
                  <span>intento {event.attemptNumber}</span>
                  {event.responseStatus !== null && <span>HTTP {event.responseStatus}</span>}
                  {event.latencyMs !== null && <span>{formatMs(event.latencyMs)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
