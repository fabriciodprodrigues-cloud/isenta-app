import { ReactNode } from 'react';

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export function Input({
  label,
  error,
  hint,
  icon,
  className,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-paper">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          className={`w-full rounded-lg border border-white/10 bg-ink-800 px-4 py-3 text-paper placeholder-slate transition-colors hover:border-white/20 focus:border-green focus:outline-none disabled:bg-ink-700 disabled:text-slate ${
            error ? 'border-red-500/50 focus:border-red-500' : ''
          } ${icon ? 'pl-10' : ''} ${className || ''}`}
          {...props}
        />
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate">
            {icon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-sm text-slate">{hint}</p>
      )}
    </div>
  );
}
