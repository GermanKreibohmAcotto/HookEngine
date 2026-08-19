import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useApiKey } from '../auth/ApiKeyContext';

const LINKS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/subscribers', label: 'Subscribers', end: false },
  { to: '/deliveries', label: 'Deliveries', end: false },
  { to: '/dlq', label: 'Dead Letters', end: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const { clearApiKey } = useApiKey();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold tracking-wide text-slate-100">HookEngine</span>
            <nav className="flex gap-1">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium ${
                      isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <button
            type="button"
            onClick={clearApiKey}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
