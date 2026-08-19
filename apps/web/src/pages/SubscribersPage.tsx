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
              : 'Failed to create subscriber',
          );
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300">Name</label>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          placeholder="Billing service"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">Target URL</label>
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
        <label className="block text-sm font-medium text-slate-300">Event types</label>
        <input
          required
          value={eventTypes}
          onChange={(event) => setEventTypes(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          placeholder="order.created, order.cancelled"
        />
        <p className="mt-1 text-xs text-slate-500">Comma-separated.</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={createSubscriber.isPending}>
          {createSubscriber.isPending ? 'Creating…' : 'Create subscriber'}
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
    <Modal title={`${subscriber.name} — signing secret`} onClose={onClose}>
      <p className="text-sm text-amber-400">
        This is shown once. Store it now — HookEngine never displays it again.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-xs text-slate-200">
          {subscriber.secret}
        </code>
        <Button onClick={handleCopy}>{copied ? 'Copied' : 'Copy'}</Button>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Done
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

  const handleDelete = (id: string, name: string): void => {
    if (window.confirm(`Delete subscriber "${name}"? This cannot be undone.`)) {
      deleteSubscriber.mutate(id);
    }
  };

  const handleRotate = (id: string, name: string): void => {
    if (
      window.confirm(
        `Rotate the signing secret for "${name}"? The old secret keeps working for 24h so ${name} has time to update.`,
      )
    ) {
      rotateSecret.mutate(id, { onSuccess: setRevealedSecret });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Subscribers</h1>
          <p className="text-sm text-slate-500">Who receives which events, and where.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateForm(true)}>
          New subscriber
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !subscribers || subscribers.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            No subscribers yet — create one to start receiving events.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Target URL</th>
                <th className="py-2 pr-4 font-medium">Event types</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Max retries</th>
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
                      {subscriber.isActive ? 'active' : 'paused'}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400">{subscriber.maxRetries}</td>
                  <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      onClick={() => handleRotate(subscriber.id, subscriber.name)}
                    >
                      Rotate secret
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDelete(subscriber.id, subscriber.name)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showCreateForm && (
        <Modal title="New subscriber" onClose={() => setShowCreateForm(false)}>
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
    </div>
  );
}
