const PALETTE = [
  'bg-primary-container text-on-primary-container',
  'bg-secondary-container text-on-secondary-container',
  'bg-tertiary-container text-on-tertiary-container',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? [parts[0]![0], parts[1]![0]] : [parts[0]?.[0] ?? '?'];
  return letters.join('').toUpperCase();
}

function paletteIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % PALETTE.length;
}

export function Avatar({ name }: { name: string }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-label-sm text-label-sm font-bold ${PALETTE[paletteIndex(name)]}`}
    >
      {initials(name)}
    </span>
  );
}
