'use client';

interface AlertsChartProps {
  expiringSoon: number;
  expired: number;
  renewalNeeded: number;
}

export function AlertsChart({
  expiringSoon,
  expired,
  renewalNeeded,
}: AlertsChartProps) {
  const total = expiringSoon + expired + renewalNeeded;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-paper-dim">Sem alertas no momento</p>
      </div>
    );
  }

  const expiringSoonPercent = (expiringSoon / total) * 100;
  const expiredPercent = (expired / total) * 100;
  const renewalNeededPercent = (renewalNeeded / total) * 100;

  return (
    <div className="space-y-6">
      {/* Barra de progresso empilhada */}
      <div>
        <div className="flex gap-2 mb-3">
          <div
            className="h-2 bg-amber rounded-full"
            style={{ width: `${expiringSoonPercent}%` }}
          />
          <div
            className="h-2 bg-red-500 rounded-full"
            style={{ width: `${expiredPercent}%` }}
          />
          <div
            className="h-2 bg-blue-500 rounded-full"
            style={{ width: `${renewalNeededPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-paper-dim uppercase tracking-wide">
              Vencendo em Breve
            </p>
            <p className="text-2xl font-bold text-amber mt-1">
              {expiringSoon}
            </p>
          </div>
          <div>
            <p className="text-xs text-paper-dim uppercase tracking-wide">
              Vencidos
            </p>
            <p className="text-2xl font-bold text-red-400 mt-1">
              {expired}
            </p>
          </div>
          <div>
            <p className="text-xs text-paper-dim uppercase tracking-wide">
              Renovação Necessária
            </p>
            <p className="text-2xl font-bold text-blue-400 mt-1">
              {renewalNeeded}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
