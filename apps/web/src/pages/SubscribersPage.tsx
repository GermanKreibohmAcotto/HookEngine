import { CheckCircle2, Lock, Plus, RefreshCw, Trash2, Unlock, Users } from 'lucide-react';
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
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { StatTile } from '../components/ui/StatTile';

const inputClasses =
  'mt-1 w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline focus:outline-2 focus:outline-primary';
const labelClasses = 'block font-label-md text-label-md text-on-surface-variant';

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
        <label className={labelClasses}>Nombre</label>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClasses}
          placeholder="Servicio de facturación"
        />
      </div>
      <div>
        <label className={labelClasses}>URL de destino</label>
        <input
          required
          type="url"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          className={inputClasses}
          placeholder="https://example.com/webhooks/hookengine"
        />
      </div>
      <div>
        <label className={labelClasses}>Tipos de evento</label>
        <input
          required
          value={eventTypes}
          onChange={(event) => setEventTypes(event.target.value)}
          className={inputClasses}
          placeholder="order.created, order.cancelled"
        />
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Separados por coma.
        </p>
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
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
      <p className="font-body-md text-body-md text-warning">
        Esto se muestra una sola vez. Guardalo ahora — HookEngine no lo vuelve a mostrar.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg bg-surface-container-lowest px-3 py-2 font-label-md text-body-sm text-on-surface">
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
  | { kind: 'delete'; id: string; name: string }
  | { kind: 'rotate'; id: string; name: string };

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
      <p className="font-body-md text-body-md text-on-surface-variant">
        {isDelete
          ? `¿Eliminar el suscriptor "${action.name}"? Esto no se puede deshacer.`
          : `¿Rotar el secreto de firma de "${action.name}"? El secreto viejo sigue funcionando durante 24h para que ${action.name} tenga tiempo de actualizarse.`}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant={isDelete ? 'danger' : 'primary'} onClick={onConfirm}>
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

  const activeCount = subscribers?.filter((subscriber) => subscriber.isActive).length ?? 0;

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
    <div className="space-y-section-margin">
      <PageHeader
        title="Suscriptores"
        subtitle="Quién recibe qué eventos, y dónde."
        action={
          <Button variant="primary" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4" />
            Nuevo suscriptor
          </Button>
        }
      />

      {subscribers && (
        <div className="grid grid-cols-2 gap-card-gap sm:max-w-md">
          <StatTile label="Suscriptores" value={String(subscribers.length)} icon={Users} />
          <StatTile label="Activos" value={String(activeCount)} icon={CheckCircle2} />
        </div>
      )}

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !subscribers || subscribers.length === 0 ? (
          <p className="py-4 text-center font-body-md text-body-md text-on-surface-variant">
            Todavía no hay suscriptores — creá uno para empezar a recibir eventos.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10 font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">URL de destino</th>
                <th className="py-2 pr-4 font-medium">Tipos de evento</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Reintentos máx.</th>
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {subscribers.map((subscriber) => (
                <tr key={subscriber.id}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={subscriber.name} />
                      <div className="min-w-0">
                        <div className="text-on-surface">{subscriber.name}</div>
                        <div className="truncate font-label-sm text-label-sm text-on-surface-variant/50">
                          {subscriber.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-xs py-3 pr-4 text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      {subscriber.targetUrl.startsWith('https:') ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-on-surface-variant/50" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5 shrink-0 text-warning" />
                      )}
                      <span className="truncate">{subscriber.targetUrl}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {subscriber.eventTypes.slice(0, 2).map((type) => (
                        <span
                          key={type}
                          className="rounded bg-surface-container-high px-1.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant"
                        >
                          {type}
                        </span>
                      ))}
                      {subscriber.eventTypes.length > 2 && (
                        <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant/50">
                          +{subscriber.eventTypes.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() =>
                        updateSubscriber.mutate({
                          id: subscriber.id,
                          patch: { isActive: !subscriber.isActive },
                        })
                      }
                      className="flex items-center gap-1.5"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${subscriber.isActive ? 'bg-primary' : 'bg-outline-variant'}`}
                      />
                      <span
                        className={`font-label-sm text-label-sm ${subscriber.isActive ? 'text-primary' : 'text-on-surface-variant'}`}
                      >
                        {subscriber.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </button>
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">{subscriber.maxRetries}</td>
                  <td className="py-3 pr-4 text-right whitespace-nowrap">
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
                      <RefreshCw className="h-3.5 w-3.5" />
                      Rotar
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
                      <Trash2 className="h-3.5 w-3.5" />
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
