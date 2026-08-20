import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function PayloadViewer({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(value, null, 2);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-surface-container-high px-2 py-1 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      <pre className="max-h-80 overflow-auto rounded-lg bg-surface-container-lowest p-3 pt-9 font-label-md text-body-sm text-on-surface-variant">
        {json}
      </pre>
    </div>
  );
}
