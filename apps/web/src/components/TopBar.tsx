import { useLocation } from 'react-router-dom';

import { useDeliveryStream } from '../api/hooks/useDeliveryStream';
import { NAV_LINKS } from '../lib/navLinks';

function activeCrumb(pathname: string): string {
  const match = NAV_LINKS.find((link) =>
    link.end ? pathname === link.to : pathname.startsWith(link.to),
  );
  return match ? `HookEngine / ${match.label}` : 'HookEngine';
}

export function TopBar() {
  const { pathname } = useLocation();
  const { connected } = useDeliveryStream();

  return (
    <header className="fixed left-64 top-0 z-40 flex h-16 w-[calc(100%-16rem)] items-center justify-between gap-3 border-b border-outline-variant/5 bg-surface/80 px-4 backdrop-blur-xl sm:px-8">
      <span className="min-w-0 truncate font-label-md text-label-md text-on-surface-variant/60">
        {activeCrumb(pathname)}
      </span>
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-highest px-3 py-1.5">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'animate-pulse bg-primary' : 'bg-outline-variant'}`}
        />
        <span className="whitespace-nowrap font-label-sm text-label-sm">
          {connected ? 'Sistema en vivo' : 'Sin conexión'}
        </span>
      </div>
    </header>
  );
}
