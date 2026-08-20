import type { ReactNode } from 'react';

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Sidebar />
      <div className="pl-64">
        <TopBar />
        <main className="mx-auto max-w-7xl space-y-section-margin px-container-padding py-section-margin pt-24">
          {children}
        </main>
      </div>
    </div>
  );
}
