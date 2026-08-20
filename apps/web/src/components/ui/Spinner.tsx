export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400 ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
}
