import { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-white/8 ${className || ''}`}>
      <table className="w-full">
        {children}
      </table>
    </div>
  );
}

interface TableHeadProps {
  children: ReactNode;
}

export function TableHead({ children }: TableHeadProps) {
  return (
    <thead className="border-b border-white/8 bg-ink-700">
      {children}
    </thead>
  );
}

interface TableBodyProps {
  children: ReactNode;
}

export function TableBody({ children }: TableBodyProps) {
  return <tbody>{children}</tbody>;
}

interface TableRowProps {
  children: ReactNode;
  href?: string;
}

export function TableRow({ children, href }: TableRowProps) {
  const className =
    'border-b border-white/8 hover:bg-ink-700/50 transition-colors';

  if (href) {
    return (
      <tr className={className}>
        {children}
      </tr>
    );
  }

  return <tr className={className}>{children}</tr>;
}

interface TableCellProps {
  children: ReactNode;
  header?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function TableCell({
  children,
  header = false,
  align = 'left',
  className,
}: TableCellProps) {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];

  const Element = header ? 'th' : 'td';

  return (
    <Element
      className={`px-6 py-4 ${alignClass} ${
        header
          ? 'font-medium text-paper-dim text-sm uppercase tracking-wide'
          : 'text-paper'
      } ${className || ''}`}
    >
      {children}
    </Element>
  );
}
