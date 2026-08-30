'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';

interface Vehicle {
  id: string;
  plate: string;
}

interface ContratoVeiculoRow {
  id: string;
  vehicleId: string;
  ativo: boolean;
  dataExclusao: string | null;
  vehicle: { plate: string };
}

interface FaturaRow {
  id: string;
  tipo: string;
  valorCentavos: number;
  formaPagamento: string;
  numeroEmpenho: string | null;
  parcelaNumero: number | null;
  parcelaTotal: number | null;
  dataVencimento: string;
  dataPagamento: string | null;
  status: string;
}

interface HistoricoPrecoRow {
  id: string;
  precoAnteriorCentavos: number;
  precoNovoCentavos: number;
  dataAlteracao: string;
  motivo: string | null;
}

interface ContratoRow {
  id: string;
  contratoPaiId: string | null;
  precoUnitarioMensalCentavos: number;
  qtdVeiculos: number;
  valorTotalPeriodoCentavos: number;
  dataInicio: string;
  dataVencimento: string;
  modalidadeContratacao: string;
  numeroProcesso: string | null;
  status: string;
  observacoes: string | null;
  veiculos: ContratoVeiculoRow[];
  faturas: FaturaRow[];
  historicoPrecos: HistoricoPrecoRow[];
}

const MODALIDADES = [
  { value: 'licitacao_pregao', label: 'Licitação / Pregão' },
  { value: 'dispensa_valor', label: 'Dispensa por valor' },
  { value: 'inexigibilidade', label: 'Inexigibilidade' },
  { value: 'adesao_ata', label: 'Adesão a ata' },
  { value: 'compra_direta', label: 'Compra direta' },
  { value: 'outro', label: 'Outro' },
];

const FORMAS_PAGAMENTO = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'PIX' },
  { value: 'empenho', label: 'Empenho' },
  { value: 'ordem_bancaria', label: 'Ordem bancária' },
  { value: 'outro', label: 'Outro' },
];

const STATUS_FATURA = [
  { value: 'emitida', label: 'Emitida' },
  { value: 'aguardando_empenho', label: 'Aguardando empenho' },
  { value: 'paga', label: 'Paga' },
  { value: 'cancelada', label: 'Cancelada' },
];

function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function estaVencido(dataVencimento: string): boolean {
  return new Date(dataVencimento) < new Date();
}

function diasRestantes(dataVencimento: string): number {
  return Math.ceil((new Date(dataVencimento).getTime() - Date.now()) / 86_400_000);
}

export default function FinanceiroOrgao() {
  const params = useParams();
  const accountId = params.accountId as string;

  const [nomeOrgao, setNomeOrgao] = useState('');
  const [veiculosDaConta, setVeiculosDaConta] = useState<Vehicle[]>([]);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [precoReferenciaCentavos, setPrecoReferenciaCentavos] = useState(9990);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Fluxo 1: novo contrato principal.
  const [formNovo, setFormNovo] = useState({
    veiculoIds: [] as string[],
    precoUnitarioMensal: '99,90',
    modalidadeContratacao: 'licitacao_pregao',
    numeroProcesso: '',
    observacoes: '',
    formaPagamento: 'boleto',
    numeroEmpenho: '',
    parcelas: '1',
  });

  // Fluxo 2: adicionar veículos -- um form por contrato principal, aberto sob demanda.
  const [contratoAdicionando, setContratoAdicionando] = useState<string | null>(null);
  const [formAdicionar, setFormAdicionar] = useState({
    veiculoIds: [] as string[],
    precoUnitarioMensal: '',
    formaPagamento: 'boleto',
    numeroEmpenho: '',
    parcelas: '1',
  });

  // Fluxo 4: renovar -- um form por contrato, aberto sob demanda.
  const [contratoRenovando, setContratoRenovando] = useState<string | null>(null);
  const [formRenovar, setFormRenovar] = useState({
    novoPrecoUnitarioMensal: '',
    motivoAlteracaoPreco: '',
    formaPagamento: 'boleto',
    numeroEmpenho: '',
    parcelas: '1',
  });

  async function carregar() {
    try {
      const [contaRes, contratosRes, configRes] = await Promise.all([
        fetch(`/api/accounts/${accountId}`),
        fetch(`/api/financeiro/contratos?accountId=${accountId}`),
        fetch('/api/financeiro/configuracao'),
      ]);

      if (contaRes.ok) {
        const conta = await contaRes.json();
        setNomeOrgao(conta.razaoSocial || conta.name);
        setVeiculosDaConta(conta.vehicles ?? []);
      }
      if (contratosRes.ok) setContratos(await contratosRes.json());
      if (configRes.ok) {
        const config = await configRes.json();
        setPrecoReferenciaCentavos(config.precoReferenciaMensalCentavos);
        setFormNovo(f => ({ ...f, precoUnitarioMensal: (config.precoReferenciaMensalCentavos / 100).toFixed(2).replace('.', ',') }));
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (accountId) void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  function centavosDoTexto(texto: string): number {
    const normalizado = texto.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(normalizado) * 100);
  }

  // Veículos ainda não vinculados ativamente a nenhum contrato.
  const veiculosDisponiveis = veiculosDaConta.filter(
    v => !contratos.some(c => c.veiculos.some(cv => cv.vehicleId === v.id && cv.ativo))
  );

  async function criarContrato() {
    setErro('');
    setSalvando(true);
    try {
      const resposta = await fetch('/api/financeiro/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          veiculoIds: formNovo.veiculoIds,
          precoUnitarioMensalCentavos: centavosDoTexto(formNovo.precoUnitarioMensal),
          modalidadeContratacao: formNovo.modalidadeContratacao,
          numeroProcesso: formNovo.numeroProcesso || null,
          observacoes: formNovo.observacoes || null,
          formaPagamento: formNovo.formaPagamento,
          numeroEmpenho: formNovo.numeroEmpenho || null,
          parcelas: Number(formNovo.parcelas) || 1,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error || 'Erro ao criar contrato');
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarVeiculos(contratoId: string) {
    setErro('');
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/financeiro/contratos/${contratoId}/adicionar-veiculos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          veiculoIds: formAdicionar.veiculoIds,
          precoUnitarioMensalCentavos: formAdicionar.precoUnitarioMensal
            ? centavosDoTexto(formAdicionar.precoUnitarioMensal)
            : undefined,
          formaPagamento: formAdicionar.formaPagamento,
          numeroEmpenho: formAdicionar.numeroEmpenho || null,
          parcelas: Number(formAdicionar.parcelas) || 1,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error || 'Erro ao adicionar veículos');
        return;
      }
      setContratoAdicionando(null);
      setFormAdicionar({ veiculoIds: [], precoUnitarioMensal: '', formaPagamento: 'boleto', numeroEmpenho: '', parcelas: '1' });
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  async function removerVeiculo(contratoVeiculoId: string) {
    if (!confirm('Remover este veículo do contrato? Não gera estorno nem crédito.')) return;
    setErro('');
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/financeiro/contrato-veiculos/${contratoVeiculoId}/remover`, {
        method: 'POST',
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error || 'Erro ao remover veículo');
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  async function renovarContrato(contratoId: string) {
    setErro('');
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/financeiro/contratos/${contratoId}/renovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novoPrecoUnitarioMensalCentavos: formRenovar.novoPrecoUnitarioMensal
            ? centavosDoTexto(formRenovar.novoPrecoUnitarioMensal)
            : undefined,
          motivoAlteracaoPreco: formRenovar.motivoAlteracaoPreco || null,
          formaPagamento: formRenovar.formaPagamento,
          numeroEmpenho: formRenovar.numeroEmpenho || null,
          parcelas: Number(formRenovar.parcelas) || 1,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error || 'Erro ao renovar contrato');
        return;
      }
      setContratoRenovando(null);
      setFormRenovar({ novoPrecoUnitarioMensal: '', motivoAlteracaoPreco: '', formaPagamento: 'boleto', numeroEmpenho: '', parcelas: '1' });
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatusFatura(faturaId: string, status: string) {
    setErro('');
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/financeiro/faturas/${faturaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error || 'Erro ao atualizar fatura');
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
        <h1 className="text-3xl font-bold text-paper">Financeiro</h1>
        <p className="text-paper-dim text-sm mt-1">{nomeOrgao}</p>
      </div>

      {erro && <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-300 text-sm">{erro}</div>}

      {contratos.length === 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-paper">Fechar contrato principal</h2></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm text-paper mb-2">Veículos cobertos</label>
              {veiculosDaConta.length === 0 ? (
                <p className="text-paper-dim text-sm">Órgão não tem veículos cadastrados.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {veiculosDaConta.map(v => (
                    <label key={v.id} className="flex items-center gap-2 text-sm text-paper">
                      <input
                        type="checkbox"
                        checked={formNovo.veiculoIds.includes(v.id)}
                        onChange={e =>
                          setFormNovo(f => ({
                            ...f,
                            veiculoIds: e.target.checked
                              ? [...f.veiculoIds, v.id]
                              : f.veiculoIds.filter(id => id !== v.id),
                          }))
                        }
                        className="accent-green"
                      />
                      {v.plate}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Preço/veículo/mês (R$)"
                value={formNovo.precoUnitarioMensal}
                onChange={e => setFormNovo(f => ({ ...f, precoUnitarioMensal: e.target.value }))}
                hint={`Referência: ${formatarCentavos(precoReferenciaCentavos)}`}
              />
              <Select
                label="Modalidade de contratação"
                value={formNovo.modalidadeContratacao}
                onChange={e => setFormNovo(f => ({ ...f, modalidadeContratacao: e.target.value }))}
                options={MODALIDADES}
              />
              <Input
                label="Nº do processo"
                value={formNovo.numeroProcesso}
                onChange={e => setFormNovo(f => ({ ...f, numeroProcesso: e.target.value }))}
              />
              <Select
                label="Forma de pagamento"
                value={formNovo.formaPagamento}
                onChange={e => setFormNovo(f => ({ ...f, formaPagamento: e.target.value }))}
                options={FORMAS_PAGAMENTO}
              />
              {formNovo.formaPagamento === 'empenho' && (
                <Input
                  label="Nº do empenho"
                  value={formNovo.numeroEmpenho}
                  onChange={e => setFormNovo(f => ({ ...f, numeroEmpenho: e.target.value }))}
                />
              )}
              <Input
                label="Parcelas"
                type="number"
                min={1}
                value={formNovo.parcelas}
                onChange={e => setFormNovo(f => ({ ...f, parcelas: e.target.value }))}
              />
            </div>
            <Input
              label="Observações"
              value={formNovo.observacoes}
              onChange={e => setFormNovo(f => ({ ...f, observacoes: e.target.value }))}
              placeholder="Ex.: motivo do desconto negociado"
            />
            {formNovo.veiculoIds.length > 0 && (
              <p className="text-sm text-paper-dim">
                Valor anual: {formatarCentavos(centavosDoTexto(formNovo.precoUnitarioMensal || '0') * 12 * formNovo.veiculoIds.length)}
                {' '}({formNovo.veiculoIds.length} veículo(s) × 12 meses)
              </p>
            )}
            <Button onClick={criarContrato} disabled={salvando || formNovo.veiculoIds.length === 0}>
              {salvando ? 'Salvando...' : 'Fechar contrato'}
            </Button>
          </CardBody>
        </Card>
      )}

      {contratos.map(contrato => {
        const vencido = estaVencido(contrato.dataVencimento) && contrato.status === 'ativo';
        const dias = diasRestantes(contrato.dataVencimento);
        const veiculosAtivos = contrato.veiculos.filter(v => v.ativo);

        return (
          <Card key={contrato.id}>
            <CardHeader className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-paper">
                  {contrato.contratoPaiId ? 'Mini-contrato (veículo adicional)' : 'Contrato principal'}
                </h2>
                <p className="text-xs text-paper-dim mt-1">
                  Vigência {formatarData(contrato.dataInicio)} — {formatarData(contrato.dataVencimento)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {contrato.status === 'cancelado' && <Badge variant="default">Cancelado</Badge>}
                {contrato.status !== 'cancelado' && vencido && <Badge variant="error">Vencido</Badge>}
                {contrato.status !== 'cancelado' && !vencido && dias <= 30 && (
                  <Badge variant="warning">{`Vence em ${dias}d`}</Badge>
                )}
                {contrato.status !== 'cancelado' && !vencido && dias > 30 && <Badge variant="success">Ativo</Badge>}
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-paper-dim">Preço/veículo/mês</p>
                  <p className="text-paper font-mono">{formatarCentavos(contrato.precoUnitarioMensalCentavos)}</p>
                </div>
                <div>
                  <p className="text-paper-dim">Veículos ativos</p>
                  <p className="text-paper font-mono">{veiculosAtivos.length} / {contrato.qtdVeiculos}</p>
                </div>
                <div>
                  <p className="text-paper-dim">Valor do período</p>
                  <p className="text-paper font-mono">{formatarCentavos(contrato.valorTotalPeriodoCentavos)}</p>
                </div>
                <div>
                  <p className="text-paper-dim">Modalidade</p>
                  <p className="text-paper">{MODALIDADES.find(m => m.value === contrato.modalidadeContratacao)?.label ?? contrato.modalidadeContratacao}</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-paper-dim mb-2">Veículos</p>
                <div className="flex flex-wrap gap-2">
                  {contrato.veiculos.map(cv => (
                    <div
                      key={cv.id}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-xs font-mono ${
                        cv.ativo ? 'bg-ink-700 text-paper' : 'bg-ink-700/40 text-paper-dim line-through'
                      }`}
                    >
                      {cv.vehicle.plate}
                      {cv.ativo && (
                        <button
                          onClick={() => removerVeiculo(cv.id)}
                          className="text-red-400 hover:text-red-300 no-underline"
                          title="Remover do contrato"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-paper-dim mb-2">Faturas</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Tipo</TableCell>
                        <TableCell>Valor</TableCell>
                        <TableCell>Parcela</TableCell>
                        <TableCell>Vencimento</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contrato.faturas.map(f => {
                        const atrasada = estaVencido(f.dataVencimento) && ['emitida', 'aguardando_empenho'].includes(f.status);
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="text-sm">{f.tipo}</TableCell>
                            <TableCell className="font-mono text-sm">{formatarCentavos(f.valorCentavos)}</TableCell>
                            <TableCell className="text-sm">{f.parcelaNumero ? `${f.parcelaNumero}/${f.parcelaTotal}` : '—'}</TableCell>
                            <TableCell className="text-sm">{formatarData(f.dataVencimento)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <select
                                  value={f.status}
                                  onChange={e => alterarStatusFatura(f.id, e.target.value)}
                                  className="text-xs px-2 py-1 bg-ink-700 border border-white/10 rounded text-paper"
                                >
                                  {STATUS_FATURA.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                                {atrasada && <Badge size="sm" variant="error">Atrasada</Badge>}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {contrato.historicoPrecos.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-paper-dim mb-2">Histórico de preço</p>
                  {contrato.historicoPrecos.map(h => (
                    <p key={h.id} className="text-xs text-paper-dim">
                      {formatarData(h.dataAlteracao)}: {formatarCentavos(h.precoAnteriorCentavos)} → {formatarCentavos(h.precoNovoCentavos)}
                      {h.motivo && ` — ${h.motivo}`}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/8">
                {!contrato.contratoPaiId && contrato.status !== 'cancelado' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setContratoAdicionando(contratoAdicionando === contrato.id ? null : contrato.id)}
                  >
                    Adicionar veículos
                  </Button>
                )}
                {contrato.status !== 'cancelado' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setContratoRenovando(contratoRenovando === contrato.id ? null : contrato.id)}
                  >
                    Renovar
                  </Button>
                )}
              </div>

              {contratoAdicionando === contrato.id && (
                <div className="space-y-3 p-4 rounded border border-white/8 bg-ink-700/30">
                  <p className="text-sm text-paper font-medium">Adicionar veículos (novo mini-contrato)</p>
                  {veiculosDisponiveis.length === 0 ? (
                    <p className="text-paper-dim text-sm">Todos os veículos do órgão já estão em algum contrato.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {veiculosDisponiveis.map(v => (
                        <label key={v.id} className="flex items-center gap-2 text-sm text-paper">
                          <input
                            type="checkbox"
                            checked={formAdicionar.veiculoIds.includes(v.id)}
                            onChange={e =>
                              setFormAdicionar(f => ({
                                ...f,
                                veiculoIds: e.target.checked
                                  ? [...f.veiculoIds, v.id]
                                  : f.veiculoIds.filter(id => id !== v.id),
                              }))
                            }
                            className="accent-green"
                          />
                          {v.plate}
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Preço/veículo/mês (R$)"
                      placeholder={`Padrão: ${formatarCentavos(contrato.precoUnitarioMensalCentavos)}`}
                      value={formAdicionar.precoUnitarioMensal}
                      onChange={e => setFormAdicionar(f => ({ ...f, precoUnitarioMensal: e.target.value }))}
                    />
                    <Select
                      label="Forma de pagamento"
                      value={formAdicionar.formaPagamento}
                      onChange={e => setFormAdicionar(f => ({ ...f, formaPagamento: e.target.value }))}
                      options={FORMAS_PAGAMENTO}
                    />
                    <Input
                      label="Parcelas"
                      type="number"
                      min={1}
                      value={formAdicionar.parcelas}
                      onChange={e => setFormAdicionar(f => ({ ...f, parcelas: e.target.value }))}
                    />
                  </div>
                  <Button size="sm" onClick={() => adicionarVeiculos(contrato.id)} disabled={salvando || formAdicionar.veiculoIds.length === 0}>
                    {salvando ? 'Salvando...' : 'Criar mini-contrato'}
                  </Button>
                </div>
              )}

              {contratoRenovando === contrato.id && (
                <div className="space-y-3 p-4 rounded border border-white/8 bg-ink-700/30">
                  <p className="text-sm text-paper font-medium">Renovar contrato</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Novo preço/veículo/mês (R$)"
                      placeholder={`Atual: ${formatarCentavos(contrato.precoUnitarioMensalCentavos)}`}
                      value={formRenovar.novoPrecoUnitarioMensal}
                      onChange={e => setFormRenovar(f => ({ ...f, novoPrecoUnitarioMensal: e.target.value }))}
                    />
                    <Select
                      label="Forma de pagamento"
                      value={formRenovar.formaPagamento}
                      onChange={e => setFormRenovar(f => ({ ...f, formaPagamento: e.target.value }))}
                      options={FORMAS_PAGAMENTO}
                    />
                    <Input
                      label="Parcelas"
                      type="number"
                      min={1}
                      value={formRenovar.parcelas}
                      onChange={e => setFormRenovar(f => ({ ...f, parcelas: e.target.value }))}
                    />
                  </div>
                  {formRenovar.novoPrecoUnitarioMensal && (
                    <Input
                      label="Motivo da alteração de preço"
                      value={formRenovar.motivoAlteracaoPreco}
                      onChange={e => setFormRenovar(f => ({ ...f, motivoAlteracaoPreco: e.target.value }))}
                    />
                  )}
                  <Button size="sm" onClick={() => renovarContrato(contrato.id)} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Confirmar renovação'}
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}

      <Link href="/dashboard/admin/orgaos">
        <Button variant="secondary">← Voltar</Button>
      </Link>
    </div>
  );
}
