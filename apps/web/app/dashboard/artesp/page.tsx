'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { format_date } from '@/lib/utils';

interface Veiculo {
  id: string;
  plate: string;
  type: string;
}

interface ArtespVeiculoRow {
  vehicleId: string;
  registroPatrimonial: string | null;
  prefixo: string | null;
  vehicle: { plate: string; type: string };
}

interface ArtespDocumentoRow {
  id: string;
  tipo: string;
  status: string;
  geradoEm: string | null;
  assinadoEm: string | null;
}

interface Cadastro {
  id: string;
  tipoEntidade: string;
  abrangencia: string | null;
  status: string;
  protocolo: string | null;
  protocoladoEm: string | null;
  veiculos: ArtespVeiculoRow[];
  documentos: ArtespDocumentoRow[];
}

const NOME_DOCUMENTO: Record<string, string> = {
  requerimento: 'Requerimento à Diretora Geral',
  declaracao_tag: 'Declaração de instalação da TAG',
  anexo_veiculos: 'Anexo de veículos (OSA)',
  declaracao_concordancia: 'Declaração de concordância',
  solicitacao_cobranca: 'Solicitação de cobrança automática',
};

const ORDEM_DOCUMENTOS = [
  'requerimento',
  'declaracao_tag',
  'anexo_veiculos',
  'declaracao_concordancia',
  'solicitacao_cobranca',
];

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  rascunho: { label: 'Rascunho', variant: 'default' },
  documentos_gerados: { label: 'Documentos gerados', variant: 'info' },
  protocolado: { label: 'Protocolado', variant: 'warning' },
  deferido: { label: 'Deferido', variant: 'success' },
  indeferido: { label: 'Indeferido', variant: 'error' },
  exigencia: { label: 'Em exigência', variant: 'warning' },
};

export default function ArtespPage() {
  const { data: session } = useSession();
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [veiculosConta, setVeiculosConta] = useState<Veiculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Passo inicial: classificação + responsável pela frota.
  const [tipoEntidade, setTipoEntidade] = useState('B');
  const [respNome, setRespNome] = useState('');
  const [respTelefone, setRespTelefone] = useState('');
  const [respEmail, setRespEmail] = useState('');

  // Frota: veículo -> campos extras.
  const [selecionados, setSelecionados] = useState<Record<string, { registroPatrimonial: string; prefixo: string }>>({});

  // Protocolo.
  const [protocoloInput, setProtocoloInput] = useState('');
  const [dataProtocoloInput, setDataProtocoloInput] = useState(new Date().toISOString().slice(0, 10));

  async function carregar() {
    const accountId = (session?.user as any)?.accountId;
    if (!accountId) return;

    try {
      const [cadRes, vehRes] = await Promise.all([
        fetch('/api/artesp/cadastro'),
        fetch(`/api/vehicles?accountId=${accountId}`),
      ]);

      if (vehRes.ok) setVeiculosConta(await vehRes.json());

      if (cadRes.ok) {
        const dados = await cadRes.json();
        setCadastro(dados);
        if (dados) {
          const mapa: Record<string, { registroPatrimonial: string; prefixo: string }> = {};
          for (const v of dados.veiculos as ArtespVeiculoRow[]) {
            mapa[v.vehicleId] = {
              registroPatrimonial: v.registroPatrimonial ?? '',
              prefixo: v.prefixo ?? '',
            };
          }
          setSelecionados(mapa);
        }
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (session?.user) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function criarCadastro() {
    setErro('');
    setSalvando(true);
    try {
      const resposta = await fetch('/api/artesp/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoEntidade,
          responsavelFrotaNome: respNome,
          responsavelFrotaTelefone: respTelefone,
          responsavelFrotaEmail: respEmail,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error || 'Erro ao criar o cadastro');
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  function toggleVeiculo(id: string) {
    setSelecionados(prev => {
      const copia = { ...prev };
      if (copia[id]) delete copia[id];
      else copia[id] = { registroPatrimonial: '', prefixo: '' };
      return copia;
    });
  }

  async function salvarFrota() {
    if (!cadastro) return;
    setErro('');
    setSalvando(true);
    try {
      const veiculos = Object.entries(selecionados).map(([vehicleId, campos]) => ({
        vehicleId,
        registroPatrimonial: campos.registroPatrimonial,
        prefixo: campos.prefixo,
      }));

      const resposta = await fetch(`/api/artesp/cadastro/${cadastro.id}/veiculos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ veiculos }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error || 'Erro ao salvar a frota');
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  async function gerarDocumentos() {
    if (!cadastro) return;
    setErro('');
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/artesp/cadastro/${cadastro.id}/gerar-documentos`, { method: 'POST' });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error || 'Erro ao gerar os documentos');
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarAssinado(documentoId: string, arquivo: File) {
    setErro('');
    setSalvando(true);
    try {
      const form = new FormData();
      form.append('file', arquivo);
      const resposta = await fetch(`/api/artesp/documentos/${documentoId}/upload-assinado`, {
        method: 'POST',
        body: form,
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error || 'Erro ao enviar o documento assinado');
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  async function protocolar() {
    if (!cadastro) return;
    setErro('');
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/artesp/cadastro/${cadastro.id}/protocolar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolo: protocoloInput, protocoladoEm: dataProtocoloInput }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(
          corpo?.pendencias
            ? `Cadastro incompleto: ${corpo.pendencias.map((p: any) => p.descricao).join('; ')}`
            : corpo?.error || 'Erro ao protocolar'
        );
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <div className="text-paper">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Cadastro ARTESP</h1>
        <p className="text-paper-dim text-sm mt-1">
          Isenção de pedágio nas rodovias concedidas de São Paulo — Portaria ARTESP nº 56/2025
        </p>
      </div>

      {erro && (
        <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-300 text-sm">{erro}</div>
      )}

      {!cadastro ? (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-paper">Iniciar cadastro</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm text-paper mb-1">Classificação da entidade</label>
              <select
                value={tipoEntidade}
                onChange={e => setTipoEntidade(e.target.value)}
                className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
              >
                <option value="B">Tipo B — Município ou outro estado (caso mais comum)</option>
                <option value="A">Tipo A — Entidade estadual de São Paulo (via SIGEF)</option>
              </select>
              <p className="text-xs text-paper-dim mt-1">
                {tipoEntidade === 'A'
                  ? 'Isenção irrestrita nas rodovias concedidas de SP.'
                  : 'Isenção nas rodovias concedidas de SP, podendo ficar restrita à 1ª Fase do Programa de Concessões conforme o enquadramento.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-paper mb-1">Responsável pela frota</label>
                <input
                  value={respNome}
                  onChange={e => setRespNome(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                />
              </div>
              <div>
                <label className="block text-sm text-paper mb-1">Telefone</label>
                <input
                  value={respTelefone}
                  onChange={e => setRespTelefone(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-paper mb-1">E-mail</label>
                <input
                  value={respEmail}
                  onChange={e => setRespEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                />
              </div>
            </div>
            <Button onClick={criarCadastro} disabled={salvando}>
              {salvando ? 'Criando...' : 'Iniciar cadastro'}
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-paper-dim text-sm">Status</p>
                <Badge variant={STATUS_BADGE[cadastro.status]?.variant ?? 'default'}>
                  {STATUS_BADGE[cadastro.status]?.label ?? cadastro.status}
                </Badge>
              </div>
              {cadastro.protocolo && (
                <div className="text-right">
                  <p className="text-paper-dim text-sm">Protocolo</p>
                  <p className="text-paper font-mono">{cadastro.protocolo}</p>
                  {cadastro.protocoladoEm && (
                    <p className="text-paper-dim text-xs">{format_date(new Date(cadastro.protocoladoEm))}</p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-paper">Frota incluída no cadastro</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {veiculosConta.length === 0 ? (
                <p className="text-paper-dim text-sm">Nenhum veículo cadastrado na frota.</p>
              ) : (
                veiculosConta.map(v => (
                  <div key={v.id} className="flex items-center gap-3 p-3 rounded border border-white/8">
                    <input
                      type="checkbox"
                      checked={Boolean(selecionados[v.id])}
                      onChange={() => toggleVeiculo(v.id)}
                      className="w-4 h-4 accent-green"
                    />
                    <span className="font-mono text-paper w-28">{v.plate}</span>
                    {selecionados[v.id] && (
                      <>
                        <input
                          placeholder="Nº patrimonial"
                          value={selecionados[v.id].registroPatrimonial}
                          onChange={e =>
                            setSelecionados(prev => ({
                              ...prev,
                              [v.id]: { ...prev[v.id], registroPatrimonial: e.target.value },
                            }))
                          }
                          className="flex-1 px-2 py-1 bg-ink-700 border border-white/10 rounded text-paper text-sm"
                        />
                        <input
                          placeholder="Prefixo"
                          value={selecionados[v.id].prefixo}
                          onChange={e =>
                            setSelecionados(prev => ({
                              ...prev,
                              [v.id]: { ...prev[v.id], prefixo: e.target.value },
                            }))
                          }
                          className="flex-1 px-2 py-1 bg-ink-700 border border-white/10 rounded text-paper text-sm"
                        />
                      </>
                    )}
                  </div>
                ))
              )}
              <Button onClick={salvarFrota} disabled={salvando || Object.keys(selecionados).length === 0}>
                {salvando ? 'Salvando...' : 'Salvar frota'}
              </Button>
              <p className="text-xs text-paper-dim">
                Cada veículo precisa já ter o CRLV (e o contrato de locação, se locado) anexado na
                tela do veículo.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-paper">Documentos</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button onClick={gerarDocumentos} disabled={salvando || cadastro.veiculos.length === 0}>
                  {salvando ? 'Gerando...' : 'Gerar documentos'}
                </Button>
                {cadastro.documentos.length === ORDEM_DOCUMENTOS.length && (
                  <a href={`/api/artesp/cadastro/${cadastro.id}/dossie`}>
                    <Button variant="secondary">Gerar dossiê único (PDF)</Button>
                  </a>
                )}
              </div>
              {cadastro.documentos.length > 0 && (
                <div className="space-y-2 mt-4">
                  {ORDEM_DOCUMENTOS.map(tipo => {
                    const doc = cadastro.documentos.find(d => d.tipo === tipo);
                    if (!doc) return null;
                    return (
                      <div key={tipo} className="flex items-center justify-between p-3 rounded border border-white/8">
                        <div>
                          <p className="text-paper text-sm">{NOME_DOCUMENTO[tipo]}</p>
                          <Badge size="sm" variant={doc.status === 'assinado' ? 'success' : 'warning'}>
                            {doc.status === 'assinado' ? 'Assinado' : 'Pendente de assinatura'}
                          </Badge>
                        </div>
                        <div className="flex gap-2 items-center">
                          <a
                            href={`/api/artesp/documentos/${doc.id}?versao=gerado`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent hover:underline"
                          >
                            Baixar
                          </a>
                          <label className="text-xs text-accent hover:underline cursor-pointer">
                            Enviar assinado
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={e => {
                                const arquivo = e.target.files?.[0];
                                if (arquivo) enviarAssinado(doc.id, arquivo);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-paper-dim mt-2">
                    Assine cada documento em{' '}
                    <a
                      href="https://assinador.iti.br"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      assinador.iti.br
                    </a>{' '}
                    (gov.br/ICP-Brasil) e envie a via assinada de volta aqui.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {cadastro.status !== 'protocolado' &&
            cadastro.status !== 'deferido' &&
            cadastro.status !== 'indeferido' && (
              <Card>
                <CardHeader>
                  <h2 className="font-semibold text-paper">Protocolo</h2>
                </CardHeader>
                <CardBody className="space-y-3">
                  <p className="text-xs text-paper-dim">
                    Fica liberado só quando todos os 5 documentos estiverem assinados — a Portaria
                    não prevê estorno por cadastro incompleto.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-paper mb-1">Número do protocolo</label>
                      <input
                        value={protocoloInput}
                        onChange={e => setProtocoloInput(e.target.value)}
                        className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-paper mb-1">Data</label>
                      <input
                        type="date"
                        value={dataProtocoloInput}
                        onChange={e => setDataProtocoloInput(e.target.value)}
                        max={new Date().toISOString().slice(0, 10)}
                        className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                      />
                    </div>
                  </div>
                  <Button onClick={protocolar} disabled={salvando || !protocoloInput}>
                    {salvando ? 'Salvando...' : 'Marcar como protocolado'}
                  </Button>
                </CardBody>
              </Card>
            )}
        </>
      )}
    </div>
  );
}
