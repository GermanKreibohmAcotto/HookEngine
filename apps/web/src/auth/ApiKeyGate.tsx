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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl"
      >
        <h1 className="text-lg font-semibold text-slate-100">HookEngine</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter the admin API key (<code className="text-slate-300">INGEST_API_KEY</code>) to
          continue.
        </p>
        <input
          type="password"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="API key"
          className="mt-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="mt-3 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
