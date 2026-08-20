import { useMetrics } from '../api/hooks/useMetrics';
import { useDeliveryStream } from '../api/hooks/useDeliveryStream';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatMs, formatPercent } from '../lib/format';
import { STATUS_LABELS } from '../lib/statusLabels';
import type { DeliveryStatus } from '../api/types';

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function OverviewPage() {
  const { data: metrics, isLoading } = useMetrics(60);
  const { events, connected } = useDeliveryStream();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Resumen</h1>
        <p className="text-sm text-slate-500">Últimos 60 minutos.</p>
      </div>

      {isLoading || !metrics ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Tasa de éxito" value={formatPercent(metrics.successRate)} />
            <StatTile label="Latencia p50" value={formatMs(metrics.latencyMs.p50)} />
            <StatTile label="Latencia p95" value={formatMs(metrics.latencyMs.p95)} />
            <StatTile label="Latencia p99" value={formatMs(metrics.latencyMs.p99)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Entregas por estado">
              <div className="space-y-2">
                {Object.entries(metrics.byStatus).length === 0 && (
                  <p className="text-sm text-slate-500">No hay entregas en esta ventana.</p>
                )}
                {Object.entries(metrics.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3 text-sm">
                    <span className="w-24 text-slate-400">
                      {STATUS_LABELS[status as DeliveryStatus]}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{
                          width: `${Math.min(100, (count / Math.max(1, Math.max(...Object.values(metrics.byStatus)))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-slate-300">{count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Códigos de respuesta">
              <div className="space-y-2">
                {Object.entries(metrics.statusCodeDistribution).length === 0 && (
                  <p className="text-sm text-slate-500">
                    No hay respuestas registradas en esta ventana.
                  </p>
                )}
                {Object.entries(metrics.statusCodeDistribution)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([code, count]) => (
                    <div key={code} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{code}</span>
                      <span className="text-slate-300">{count}</span>
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
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-600'}`}
            />
            {connected ? 'conectado' : 'conectando…'}
          </span>
        }
      >
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">
            Esperando actividad de entregas — dispará un evento y va a aparecer acá.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {events.map((event, index) => (
              <li
                key={`${event.deliveryId}-${event.attemptNumber}-${index}`}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={event.status} />
                  <span className="text-slate-300">{event.eventType}</span>
                  <span className="text-slate-500">→ {event.subscriberName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
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
