import { ReactNode } from 'react';

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

const variants = {
  primary:
    'bg-green text-ink-900 hover:bg-green/90 disabled:bg-green/50',
  secondary:
    'bg-ink-700 text-paper hover:bg-ink-600 disabled:bg-ink-700/50',
  ghost: 'text-paper hover:bg-ink-700 disabled:text-slate',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-lg font-medium transition-all disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className || ''}`}
      {...props}
    >
      {loading ? '⏳ Processando...' : children}
    </button>
  );
}
