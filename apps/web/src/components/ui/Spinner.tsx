import { Loader2 } from 'lucide-react';

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <Loader2
      className={`h-5 w-5 animate-spin text-primary ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
}
