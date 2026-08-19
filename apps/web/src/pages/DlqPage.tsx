import { useState } from 'react';

import { useBulkRetryDeadLetters, useDlq, useRetryDeadLetter } from '../api/hooks/useDlq';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';

export function DlqPage() {
  const { data, isLoading } = useDlq();
  const retryOne = useRetryDeadLetter();
  const retryBulk = useBulkRetryDeadLetters();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string): void => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = (): void => {
    if (!data) return;
    setSelected((previous) =>
      previous.size === data.items.length
        ? new Set()
        : new Set(data.items.map((item) => item.deliveryId)),
    );
  };

  const handleBulkRetry = (): void => {
    retryBulk.mutate([...selected], { onSuccess: () => setSelected(new Set()) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Dead letter queue</h1>
          <p className="text-sm text-slate-500">
            Deliveries that exhausted every retry — nothing here is auto-retried.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={selected.size === 0 || retryBulk.isPending}
          onClick={handleBulkRetry}
        >
          {retryBulk.isPending ? 'Retrying…' : `Retry selected (${selected.size})`}
        </Button>
      </div>

      <Card>
        {isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Nothing dead right now — that&apos;s the goal.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">
                  <input
                    type="checkbox"
                    checked={selected.size === data.items.length}
                    onChange={toggleAll}
                    className="rounded border-slate-700 bg-slate-950"
                  />
                </th>
                <th className="py-2 pr-4 font-medium">Event</th>
                <th className="py-2 pr-4 font-medium">Subscriber</th>
                <th className="py-2 pr-4 font-medium">Target</th>
                <th className="py-2 pr-4 font-medium">Attempts</th>
                <th className="py-2 pr-4 font-medium">Died</th>
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.items.map((item) => (
                <tr key={item.deliveryId}>
                  <td className="py-2.5 pr-4">
                    <input
                      type="checkbox"
                      checked={selected.has(item.deliveryId)}
                      onChange={() => toggle(item.deliveryId)}
                      className="rounded border-slate-700 bg-slate-950"
                    />
                  </td>
                  <td className="py-2.5 pr-4 text-slate-200">{item.event.eventType}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{item.subscriber.name}</td>
                  <td className="py-2.5 pr-4 max-w-xs truncate text-slate-500">
                    {item.subscriber.targetUrl}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400">{item.attemptCount}</td>
                  <td className="py-2.5 pr-4 text-slate-500">
                    {item.completedAt ? new Date(item.completedAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <Button
                      variant="ghost"
                      disabled={retryOne.isPending}
                      onClick={() => retryOne.mutate(item.deliveryId)}
                    >
                      Retry
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && (
          <p className="mt-3 text-xs text-slate-500">
            Showing {data.items.length} of {data.total}
          </p>
        )}
      </Card>
    </div>
  );
}
