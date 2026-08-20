import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANT_STYLES: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-fixed-dim shadow-sm',
  secondary: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
  danger: 'bg-error/10 text-error hover:bg-error/20',
  ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-label-md text-label-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}
