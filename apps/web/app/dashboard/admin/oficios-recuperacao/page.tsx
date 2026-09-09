'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Resumo {
  orgaosVerificados: number;
  gruposTentados: number;
  recuperados: number;
  naoEncontrados: number;
  ambiguos: number;
  erros: string[];
  restamPendentes: boolean;
}

export default function RecuperacaoDeOficios() {
  const [buscando, setBuscando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState('');

  async function buscarAgora() {
    setBuscando(true);
    setErro('');
    setResumo(null);

    try {
      const resposta = await fetch('/api/oficios/recuperar-agora', { method: 'POST' });
      const corpo = await resposta.json();

      if (resposta.ok) {
        setResumo(corpo);
      } else {
        setErro(corpo.error ?? 'Não foi possível buscar agora.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-paper">Recuperação de Ofícios Antigos</h1>
          <p className="mt-1 text-sm text-paper-dim">
            Busca, na cópia em Enviados da caixa institucional de cada órgão, ofícios enviados
            antes do arquivamento automático existir.
          </p>
        </div>
        <Button onClick={buscarAgora} loading={buscando}>
          Buscar documentos antigos agora
        </Button>
      </div>

      <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
        Isto é melhor esforço, não uma garantia: só encontra algo se o órgão tiver IMAP
        configurado e a caixa acessível, e só para envios feitos depois que a cópia em Enviados
        passou a existir. Uma tentativa concluída (achou ou não achou) não é repetida
        automaticamente — se a caixa de um órgão estava fora do ar, rode de novo depois que ela
        voltar.
      </div>

      {erro && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-300">{erro}</div>
      )}

      {resumo && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-paper">Resultado</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-2xl font-bold text-paper">{resumo.orgaosVerificados}</div>
                <p className="text-xs text-paper-dim">Órgãos verificados</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-green">{resumo.recuperados}</div>
                <p className="text-xs text-paper-dim">Recuperados</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-paper-dim">{resumo.naoEncontrados}</div>
                <p className="text-xs text-paper-dim">Não encontrados</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber">{resumo.ambiguos}</div>
                <p className="text-xs text-paper-dim">Ambíguos (mais de 1 achado)</p>
              </div>
            </div>

            {resumo.restamPendentes && (
              <div className="rounded border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-300">
                Ainda há protocolos pendentes que não couberam nesta busca ({resumo.gruposTentados}{' '}
                tentado{resumo.gruposTentados === 1 ? '' : 's'} desta vez) — clique em &quot;Buscar
                documentos antigos agora&quot; de novo pra continuar de onde parou.
              </div>
            )}

            {resumo.erros.length > 0 && (
              <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
                {resumo.erros.join(' · ')}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">Voltar</Button>
        </Link>
      </div>
    </div>
  );
}
