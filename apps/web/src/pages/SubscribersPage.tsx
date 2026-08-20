import { useState, type FormEvent } from 'react';

import {
  useCreateSubscriber,
  useDeleteSubscriber,
  useRotateSecret,
  useSubscribers,
  useUpdateSubscriber,
} from '../api/hooks/useSubscribers';
import type { CreatedSubscriber } from '../api/types';
import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';

function CreateSubscriberForm({
  onCreated,
  onCancel,
}: {
  onCreated: (subscriber: CreatedSubscriber) => void;
  onCancel: () => void;
}) {
  const createSubscriber = useCreateSubscriber();
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [eventTypes, setEventTypes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    setError(null);

    const types = eventTypes
      .split(',')
      .map((type) => type.trim())
      .filter((type) => type.length > 0);

    createSubscriber.mutate(
      { name, targetUrl, eventTypes: types },
      {
        onSuccess: onCreated,
        onError: (mutationError) => {
          setError(
            mutationError instanceof ApiError
              ? mutationError.message
              : 'No se pudo crear el suscriptor.',
          );
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300">Nombre</label>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          placeholder="Servicio de facturación"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">URL de destino</label>
        <input
          required
          type="url"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          placeholder="https://example.com/webhooks/hookengine"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">Tipos de evento</label>
        <input
          required
          value={eventTypes}
          onChange={(event) => setEventTypes(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          placeholder="order.created, order.cancelled"
        />
        <p className="mt-1 text-xs text-slate-500">Separados por coma.</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={createSubscriber.isPending}>
          {createSubscriber.isPending ? 'Creando…' : 'Crear suscriptor'}
        </Button>
      </div>
    </form>
  );
}

function SecretRevealModal({
  subscriber,
  onClose,
}: {
  subscriber: CreatedSubscriber;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(subscriber.secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Modal title={`${subscriber.name} — secreto de firma`} onClose={onClose}>
      <p className="text-sm text-amber-400">
        Esto se muestra una sola vez. Guardalo ahora — HookEngine no lo vuelve a mostrar.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-xs text-slate-200">
          {subscriber.secret}
        </code>
        <Button onClick={handleCopy}>{copied ? 'Copiado' : 'Copiar'}</Button>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Listo
        </Button>
      </div>
    </Modal>
  );
}

type ConfirmAction =
  { kind: 'delete'; id: string; name: string } | { kind: 'rotate'; id: string; name: string };

function ConfirmActionModal({
  action,
  onConfirm,
  onCancel,
}: {
  action: ConfirmAction;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDelete = action.kind === 'delete';

  return (
    <Modal title={isDelete ? 'Eliminar suscriptor' : 'Rotar secreto'} onClose={onCancel}>
      <p className="text-sm text-slate-300">
        {isDelete
          ? `¿Eliminar el suscriptor "${action.name}"? Esto no se puede deshacer.`
          : `¿Rotar el secreto de firma de "${action.name}"? El secreto viejo sigue funcionando durante 24h para que ${action.name} tenga tiempo de actualizarse.`}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          {isDelete ? 'Eliminar' : 'Rotar'}
        </Button>
      </div>
    </Modal>
  );
}

export function SubscribersPage() {
  const { data: subscribers, isLoading } = useSubscribers();
  const updateSubscriber = useUpdateSubscriber();
  const deleteSubscriber = useDeleteSubscriber();
  const rotateSecret = useRotateSecret();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<CreatedSubscriber | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const handleConfirm = (): void => {
    if (!confirmAction) return;
    if (confirmAction.kind === 'delete') {
      deleteSubscriber.mutate(confirmAction.id);
    } else {
      rotateSecret.mutate(confirmAction.id, { onSuccess: setRevealedSecret });
    }
    setConfirmAction(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Suscriptores</h1>
          <p className="text-sm text-slate-500">Quién recibe qué eventos, y dónde.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateForm(true)}>
          Nuevo suscriptor
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !subscribers || subscribers.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Todavía no hay suscriptores — creá uno para empezar a recibir eventos.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">URL de destino</th>
                <th className="py-2 pr-4 font-medium">Tipos de evento</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Reintentos máx.</th>
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {subscribers.map((subscriber) => (
                <tr key={subscriber.id}>
                  <td className="py-2.5 pr-4 text-slate-200">{subscriber.name}</td>
                  <td className="py-2.5 pr-4 max-w-xs truncate text-slate-400">
                    {subscriber.targetUrl}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400">{subscriber.eventTypes.join(', ')}</td>
                  <td className="py-2.5 pr-4">
                    <button
                      type="button"
                      onClick={() =>
                        updateSubscriber.mutate({
                          id: subscriber.id,
                          patch: { isActive: !subscriber.isActive },
                        })
                      }
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        subscriber.isActive
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {subscriber.isActive ? 'activo' : 'pausado'}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400">{subscriber.maxRetries}</td>
                  <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setConfirmAction({
                          kind: 'rotate',
                          id: subscriber.id,
                          name: subscriber.name,
                        })
                      }
                    >
                      Rotar secreto
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setConfirmAction({
                          kind: 'delete',
                          id: subscriber.id,
                          name: subscriber.name,
                        })
                      }
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showCreateForm && (
        <Modal title="Nuevo suscriptor" onClose={() => setShowCreateForm(false)}>
          <CreateSubscriberForm
            onCancel={() => setShowCreateForm(false)}
            onCreated={(subscriber) => {
              setShowCreateForm(false);
              setRevealedSecret(subscriber);
            }}
          />
        </Modal>
      )}

      {revealedSecret && (
        <SecretRevealModal subscriber={revealedSecret} onClose={() => setRevealedSecret(null)} />
      )}

      {confirmAction && (
        <ConfirmActionModal
          action={confirmAction}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
