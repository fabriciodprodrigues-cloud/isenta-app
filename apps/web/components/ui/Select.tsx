interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  error,
  hint,
  options,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-paper">
          {label}
        </label>
      )}
      <select
        className={`w-full rounded-lg border border-white/10 bg-ink-800 px-4 py-3 text-paper transition-colors hover:border-white/20 focus:border-green focus:outline-none disabled:bg-ink-700 disabled:text-slate ${
          error ? 'border-red-500/50 focus:border-red-500' : ''
        } ${className || ''}`}
        {...props}
      >
        <option value="">Selecione uma opção</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-sm text-slate">{hint}</p>
      )}
    </div>
  );
}
