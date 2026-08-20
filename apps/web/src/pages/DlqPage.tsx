import { Mail, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { useBulkRetryDeadLetters, useDlq, useRetryDeadLetter } from '../api/hooks/useDlq';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { StatTile } from '../components/ui/StatTile';
import { formatDateTime } from '../lib/format';

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
    <div className="space-y-section-margin">
      <PageHeader
        title="Mensajes muertos"
        subtitle="Entregas que agotaron todos los reintentos — acá nada se reintenta solo."
        action={
          <Button
            variant="primary"
            disabled={selected.size === 0 || retryBulk.isPending}
            onClick={handleBulkRetry}
          >
            <RotateCcw className="h-4 w-4" />
            {retryBulk.isPending ? 'Reintentando…' : `Reintentar seleccionadas (${selected.size})`}
          </Button>
        }
      />

      {data && (
        <div className="max-w-xs">
          <StatTile label="Total en cola" value={String(data.total)} icon={Mail} />
        </div>
      )}

      <Card>
        {isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-4 text-center font-body-md text-body-md text-on-surface-variant">
            No hay nada muerto ahora mismo — ese es el objetivo.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10 font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                <th className="py-2 pr-4 font-medium">
                  <input
                    type="checkbox"
                    checked={selected.size === data.items.length}
                    onChange={toggleAll}
                    className="rounded border-outline-variant bg-surface-container-lowest accent-primary"
                  />
                </th>
                <th className="py-2 pr-4 font-medium">Evento</th>
                <th className="py-2 pr-4 font-medium">Suscriptor</th>
                <th className="py-2 pr-4 font-medium">Destino</th>
                <th className="py-2 pr-4 font-medium">Intentos</th>
                <th className="py-2 pr-4 font-medium">Murió</th>
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {data.items.map((item) => (
                <tr key={item.deliveryId}>
                  <td className="py-3 pr-4">
                    <input
                      type="checkbox"
                      checked={selected.has(item.deliveryId)}
                      onChange={() => toggle(item.deliveryId)}
                      className="rounded border-outline-variant bg-surface-container-lowest accent-primary"
                    />
                  </td>
                  <td className="py-3 pr-4 text-on-surface">{item.event.eventType}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">{item.subscriber.name}</td>
                  <td className="max-w-xs truncate py-3 pr-4 text-on-surface-variant/60">
                    {item.subscriber.targetUrl}
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">{item.attemptCount}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">
                    {item.completedAt ? formatDateTime(item.completedAt) : '—'}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <Button
                      variant="ghost"
                      disabled={retryOne.isPending}
                      onClick={() => retryOne.mutate(item.deliveryId)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reintentar
                    </Button>
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
    </div>
  );
}
