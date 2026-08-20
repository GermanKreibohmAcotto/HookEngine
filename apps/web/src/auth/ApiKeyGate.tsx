import { Webhook } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { useApiKey } from './ApiKeyContext';

/** Blocks rendering of its children until an admin API key is set — this dashboard's only auth. */
export function ApiKeyGate({ children }: { children: ReactNode }) {
  const { apiKey, setApiKey } = useApiKey();
  const [draft, setDraft] = useState('');

  if (apiKey) {
    return <>{children}</>;
  }

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed) {
      setApiKey(trimmed);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-surface-container-low p-8 shadow-2xl"
      >
        <div className="mb-1 flex items-center gap-2.5">
          <Webhook className="h-6 w-6 text-primary" strokeWidth={2.25} />
          <h1 className="font-headline-md text-headline-md text-on-surface">HookEngine</h1>
        </div>
        <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
          Ingresá la API key de administración (
          <code className="text-on-surface">INGEST_API_KEY</code>) para continuar.
        </p>
        <input
          type="password"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="API key"
          className="mt-5 w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline focus:outline-2 focus:outline-primary"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="mt-3 w-full rounded-lg bg-primary px-3 py-2.5 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar
        </button>
      </form>
    </div>
  );
}
