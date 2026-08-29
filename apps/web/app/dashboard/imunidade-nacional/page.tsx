'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface ConcessionariaImunidade {
  id: string;
  nome: string;
  status: string;
  motivo: string | null;
}

interface Resumo {
  status: 'IMUNE' | 'PARCIAL' | 'COM_RISCO';
  totalConcessionariasEmail: number;
  confirmadas: number;
  comProblema: number;
  emAndamento: number;
  concessionariasComProblema: ConcessionariaImunidade[];
  concessionariasPendentes: ConcessionariaImunidade[];
  concessionariasSemCanal: number;
}

const SELO: Record<string, { label: string; variant: 'success' | 'warning' | 'error'; descricao: string }> = {
  IMUNE: {
    label: 'Imune',
    variant: 'success',
    descricao: 'Sua frota está isenta e confirmada em todas as concessionárias já cobertas pela plataforma.',
  },
  PARCIAL: {
    label: 'Em andamento',
    variant: 'warning',
    descricao: 'A Isenta já está tratando a isenção da sua frota — algumas confirmações ainda estão pendentes.',
  },
  COM_RISCO: {
    label: 'Atenção',
    variant: 'error',
    descricao: 'Há concessionárias com problema no pedido — a Isenta já está tratando.',
  },
};

export default function ImunidadeNacionalOperador() {
  const { data: session } = useSession();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const accountId = (session?.user as any)?.accountId;
    if (!accountId) return;

    fetch(`/api/imunidade/${accountId}`)
      .then(async r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(dados => setResumo(dados.resumo))
      .catch(() => setErro('Não foi possível carregar o status de imunidade.'))
      .finally(() => setCarregando(false));
  }, [session]);

  if (carregando) {
    return <div className="text-paper">Carregando...</div>;
  }

  if (erro || !resumo) {
    return <div className="text-paper">{erro || 'Nenhuma informação disponível ainda.'}</div>;
  }

  const selo = SELO[resumo.status];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Imunidade Nacional</h1>
        <p className="text-paper-dim text-sm mt-1">
          Acompanhamento do pedido de isenção da sua frota em todas as concessionárias do Brasil.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-4">
            <Badge variant={selo.variant} size="md">{selo.label}</Badge>
            <p className="text-paper font-semibold">
              {resumo.confirmadas} de {resumo.totalConcessionariasEmail} concessionárias confirmadas
            </p>
          </div>
          <p className="text-paper-dim text-sm">{selo.descricao}</p>
          {resumo.concessionariasSemCanal > 0 && (
            <p className="text-paper-dim text-xs">
              +{resumo.concessionariasSemCanal} concessionária(s) ainda sem cobertura automatizada na
              plataforma — a Isenta está trabalhando pra ampliar essa lista.
            </p>
          )}
        </CardBody>
      </Card>

      {resumo.concessionariasComProblema.length > 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-red-400">Concessionárias com pendência de atenção</h2></CardHeader>
          <CardBody className="space-y-2">
            <p className="text-xs text-paper-dim mb-2">
              Há risco de cobrança indevida nestas rodovias enquanto isso não é resolvido. A Isenta já
              foi notificada e está tratando.
            </p>
            {resumo.concessionariasComProblema.map(c => (
              <div key={c.id} className="text-sm text-paper-dim">
                <span className="text-paper">{c.nome}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {resumo.concessionariasPendentes.length > 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-amber-400">Aguardando confirmação</h2></CardHeader>
          <CardBody className="space-y-2">
            {resumo.concessionariasPendentes.map(c => (
              <div key={c.id} className="text-sm text-paper-dim">
                <span className="text-paper">{c.nome}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
