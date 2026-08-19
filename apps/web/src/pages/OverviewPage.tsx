import { useMetrics } from '../api/hooks/useMetrics';
import { useDeliveryStream } from '../api/hooks/useDeliveryStream';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function formatPercent(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

export function OverviewPage() {
  const { data: metrics, isLoading } = useMetrics(60);
  const { events, connected } = useDeliveryStream();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Overview</h1>
        <p className="text-sm text-slate-500">Last 60 minutes.</p>
      </div>

      {isLoading || !metrics ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Success rate" value={formatPercent(metrics.successRate)} />
            <StatTile label="p50 latency" value={formatMs(metrics.latencyMs.p50)} />
            <StatTile label="p95 latency" value={formatMs(metrics.latencyMs.p95)} />
            <StatTile label="p99 latency" value={formatMs(metrics.latencyMs.p99)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Deliveries by status">
              <div className="space-y-2">
                {Object.entries(metrics.byStatus).length === 0 && (
                  <p className="text-sm text-slate-500">No deliveries in this window.</p>
                )}
                {Object.entries(metrics.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3 text-sm">
                    <span className="w-24 text-slate-400">{status}</span>
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

            <Card title="Response status codes">
              <div className="space-y-2">
                {Object.entries(metrics.statusCodeDistribution).length === 0 && (
                  <p className="text-sm text-slate-500">No responses recorded in this window.</p>
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
        title="Live delivery feed"
        action={
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-600'}`}
            />
            {connected ? 'connected' : 'connecting…'}
          </span>
        }
      >
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">
            Waiting for delivery activity — trigger an event and watch it show up here.
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
                  <span>attempt {event.attemptNumber}</span>
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
