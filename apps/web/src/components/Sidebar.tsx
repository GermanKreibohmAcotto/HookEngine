import { LogOut, Webhook } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useApiKey } from '../auth/ApiKeyContext';
import { NAV_LINKS } from '../lib/navLinks';

export function Sidebar() {
  const { clearApiKey } = useApiKey();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-surface-container-low">
      <div className="flex items-center gap-3 p-6">
        <Webhook className="h-7 w-7 text-primary" strokeWidth={2.25} />
        <span className="font-headline-md text-headline-md tracking-tight text-primary">
          HookEngine
        </span>
      </div>
      <nav className="mt-4 flex-1 space-y-1 px-4">
        {NAV_LINKS.map(({ to, label, end, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-200 ${
                isActive
                  ? 'bg-secondary-container font-semibold text-on-secondary-container shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`
            }
          >
            <Icon className="h-[22px] w-[22px] shrink-0 transition-transform group-hover:scale-110" />
            <span className="font-label-md text-label-md">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-outline-variant/10 p-4">
        <button
          type="button"
          onClick={clearApiKey}
          className="flex w-full items-center gap-3 rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <LogOut className="h-[20px] w-[20px]" />
          <span className="font-label-md text-label-md">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
