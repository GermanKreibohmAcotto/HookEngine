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
        className="absolute right-2 top-2 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-3 pt-8 text-xs text-slate-300">
        {json}
      </pre>
    </div>
  );
}
