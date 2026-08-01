interface BadgeProps {
  children: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

const variants = {
  default: 'bg-slate/20 text-slate',
  success: 'bg-green-dim text-green',
  warning: 'bg-amber-dim text-amber',
  error: 'bg-red-900/30 text-red-400',
  info: 'bg-blue-900/30 text-blue-400',
};

const sizes = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
}: BadgeProps) {
  return (
    <span
      className={`inline-block rounded-full font-medium font-mono ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
}
