import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function Card({ title, children, action }: CardProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      {(title ?? action) && (
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          {title && <h2 className="text-sm font-medium text-slate-200">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
