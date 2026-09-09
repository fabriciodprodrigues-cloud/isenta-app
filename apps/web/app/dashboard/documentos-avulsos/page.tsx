'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type TipoDocumento = 'GENERICO' | 'DECLARACAO_TAG' | 'CONCESSIONARIA' | 'ARTESP';

interface Conta {
  id: string;
  name: string;
}

interface Veiculo {
  id: string;
  plate: string;
}

interface Concessionaria {
  id: string;
  name: string;
  modeloDocumento: { tipo: string; ativo: boolean } | null;
}

const ROTULO_TIPO: Record<TipoDocumento, string> = {
  GENERICO: 'Ofício genérico da Isenta',
  DECLARACAO_TAG: 'Declaração de Instalação de TAG',
  CONCESSIONARIA: 'Formulário específico de concessionária',
  ARTESP: 'Documentos ARTESP',
};

export default function GeradorDeDocumentosAvulsos() {
  const { data: session } = useSession();
  const papel = (session?.user as any)?.role;
  const contaPropria = (session?.user as any)?.accountId as string | undefined;

  const [contas, setContas] = useState<Conta[]>([]);
  const [accountId, setAccountId] = useState('');
  const [tipo, setTipo] = useState<TipoDocumento>('GENERICO');
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [concessionariaId, setConcessionariaId] = useState('');
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [veiculosSelecionados, setVeiculosSelecionados] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  // Admin escolhe o órgão; operador usa direto a própria conta -- mesmo
  // padrão de "travado na própria conta" usado no resto do app.
  useEffect(() => {
    if (!session?.user) return;
    if (papel === 'admin') {
      fetch('/api/accounts')
        .then(r => (r.ok ? r.json() : []))
        .then(dados => setContas(dados.map((c: any) => ({ id: c.id, name: c.name }))))
        .catch(() => {});
    } else if (contaPropria) {
      setAccountId(contaPropria);
    }
  }, [session, papel, contaPropria]);

  useEffect(() => {
    fetch('/api/concessionaires')
      .then(r => (r.ok ? r.json() : []))
      .then(setConcessionarias)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setVeiculosSelecionados([]);
    if (!accountId) {
      setVeiculos([]);
      return;
    }
    fetch(`/api/vehicles?accountId=${accountId}`)
      .then(r => (r.ok ? r.json() : []))
      .then(dados => setVeiculos((Array.isArray(dados) ? dados : dados.vehicles ?? []).map((v: any) => ({ id: v.id, plate: v.plate }))))
      .catch(() => {});
  }, [accountId]);

  const concessionariasComModelo = useMemo(
    () => concessionarias.filter(c => c.modeloDocumento?.ativo),
    [concessionarias]
  );

  function alternarVeiculo(id: string) {
    setVeiculosSelecionados(atual =>
      atual.includes(id) ? atual.filter(v => v !== id) : [...atual, id]
    );
  }

  function selecionarTodos() {
    setVeiculosSelecionados(veiculos.map(v => v.id));
  }

  async function gerar() {
    setErro('');

    if (!accountId) {
      setErro('Escolha o órgão.');
      return;
    }
    if (tipo === 'CONCESSIONARIA' && !concessionariaId) {
      setErro('Escolha a concessionária.');
      return;
    }
    if (veiculosSelecionados.length === 0) {
      setErro('Selecione ao menos um veículo.');
      return;
    }

    setGerando(true);
    try {
      const resposta = await fetch('/api/documentos-avulsos/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          tipo,
          concessionariaId: tipo === 'CONCESSIONARIA' ? concessionariaId : undefined,
          veiculoIds: veiculosSelecionados,
        }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error ?? 'Não foi possível gerar o documento.');
        return;
      }

      const disposicao = resposta.headers.get('Content-Disposition') ?? '';
      const nomeArquivo = /filename="([^"]+)"/.exec(disposicao)?.[1] ?? 'documento';
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Gerar Documento Avulso</h1>
        <p className="mt-1 text-sm text-paper-dim">
          Gera um documento pra conferência ou envio manual pontual -- não dispara e-mail nem
          muda status de nenhuma solicitação.
        </p>
      </div>

      {erro && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">{erro}</div>
      )}

      <Card>
        <CardHeader><h2 className="font-semibold text-paper">1. Órgão</h2></CardHeader>
        <CardBody>
          {papel === 'admin' ? (
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full max-w-md rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
            >
              <option value="">Selecione...</option>
              {contas.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-paper-dim">Gerando pro seu próprio órgão.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-paper">2. Tipo de documento</h2></CardHeader>
        <CardBody className="space-y-3">
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value as TipoDocumento)}
            className="w-full max-w-md rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          >
            {(Object.keys(ROTULO_TIPO) as TipoDocumento[]).map(t => (
              <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
            ))}
          </select>

          {tipo === 'ARTESP' && accountId && (
            <div className="rounded border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-300">
              Documentos ARTESP têm um fluxo próprio (cadastro, TAG de OSA, assinatura gov.br).{' '}
              <Link href={`/dashboard/admin/orgaos/${accountId}/artesp`} className="underline">
                Ir para o módulo ARTESP
              </Link>
            </div>
          )}

          {tipo === 'CONCESSIONARIA' && (
            <select
              value={concessionariaId}
              onChange={e => setConcessionariaId(e.target.value)}
              className="w-full max-w-md rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
            >
              <option value="">Selecione a concessionária...</option>
              {concessionariasComModelo.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.modeloDocumento?.tipo})</option>
              ))}
            </select>
          )}
        </CardBody>
      </Card>

      {tipo !== 'ARTESP' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-paper">3. Veículos</h2>
                {veiculos.length > 0 && (
                  <button type="button" onClick={selecionarTodos} className="text-sm text-green hover:underline">
                    Selecionar todos
                  </button>
                )}
              </div>
            </CardHeader>
            <CardBody>
              {veiculos.length === 0 ? (
                <p className="text-sm text-paper-dim">Escolha um órgão pra ver a frota.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {veiculos.map(v => (
                    <label key={v.id} className="flex items-center gap-2 text-sm text-paper">
                      <input
                        type="checkbox"
                        checked={veiculosSelecionados.includes(v.id)}
                        onChange={() => alternarVeiculo(v.id)}
                        className="h-4 w-4 rounded accent-green"
                      />
                      {v.plate}
                    </label>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Button onClick={gerar} loading={gerando}>
            Gerar e baixar
          </Button>
        </>
      )}

      <div>
        <Link href="/dashboard">
          <Button variant="secondary">Voltar</Button>
        </Link>
      </div>
    </div>
  );
}
