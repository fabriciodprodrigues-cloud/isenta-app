interface BarrierLogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function BarrierLogo({
  size = 'md',
  animated = false,
}: BarrierLogoProps) {
  const sizes = {
    sm: 32,
    md: 64,
    lg: 84,
  };

  const viewSize = sizes[size];

  return (
    <svg
      width={viewSize}
      height={viewSize}
      viewBox="0 0 84 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Linha horizontal (pista) */}
      <line
        x1="42"
        y1="70"
        x2="66"
        y2="70"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.5"
        className="text-slate"
      />

      {/* Barra da cancela */}
      <g className={animated ? 'barrier-arm' : ''}>
        {/* Barra principal (branca) */}
        <rect
          x="38"
          y="18"
          width="4"
          height="52"
          rx="2"
          fill="currentColor"
          className="text-paper"
        />
        {/* Segmentos âmbar */}
        <rect
          x="38"
          y="18"
          width="4"
          height="9"
          rx="2"
          fill="currentColor"
          className="text-amber"
        />
        <rect
          x="38"
          y="34"
          width="4"
          height="9"
          rx="2"
          fill="currentColor"
          className="text-amber"
        />
      </g>

      {/* Círculo de sinal (luz) */}
      <circle
        cx="42"
        cy="70"
        r="4"
        className={`${animated ? 'pulse-dot' : ''} text-green`}
        fill="currentColor"
      />
    </svg>
  );
}
