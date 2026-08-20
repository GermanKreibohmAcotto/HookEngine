import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function Card({ title, children, action }: CardProps) {
  return (
    <div className="rounded-xl bg-surface-container-low p-6 shadow-sm">
      {(title ?? action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
