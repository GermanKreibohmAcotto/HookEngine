import type { LucideIcon } from 'lucide-react';

interface StatTileProps {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
}

export function StatTile({ label, value, unit, icon: Icon }: StatTileProps) {
  return (
    <div className="rounded-xl bg-surface-container p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-headline-xl text-[40px] font-bold leading-none text-on-surface">
          {value}
        </span>
        {unit && <span className="font-headline-md text-headline-md text-on-surface-variant">{unit}</span>}
      </div>
    </div>
  );
}
