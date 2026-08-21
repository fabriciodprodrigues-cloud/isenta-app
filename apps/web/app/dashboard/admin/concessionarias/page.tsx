'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { format_estados } from '@/lib/utils';

interface Concessionaria {
  id: string;
  name: string;
  regulador: string;
  estados: string | null;
  situacao: string;
  canalIsentos: string | null;
  tipoCanal: string | null;
  observacoes: string | null;
  ativoParaCadastro: boolean;
}

const ROTULO_CANAL: Record<string, string> = {
  EMAIL: 'E-mail',
  PORTAL_WEB: 'Portal web',
  PORTAL_MAIS_ATENDIMENTO: 'Portal +Atendimento',
  MANUAL: 'Manual',
};

const COR_CANAL: Record<string, string> = {
  EMAIL: 'bg-green-900/20 text-green-400',
  PORTAL_WEB: 'bg-blue-900/20 text-blue-400',
  PORTAL_MAIS_ATENDIMENTO: 'bg-blue-900/20 text-blue-400',
  MANUAL: 'bg-amber-900/20 text-amber-400',
};

/** Ajuda contextual: o formato esperado muda conforme o tipo de canal. */
const DICA_DESTINO: Record<string, string> = {
  EMAIL: 'ex: isentos@concessionaria.com.br',
  PORTAL_WEB: 'ex: https://portal.concessionaria.com.br/isentos',
  PORTAL_MAIS_ATENDIMENTO: 'ex: https://concessionaria.com.br/isentos',
  MANUAL: 'telefone, endereço ou instrução (opcional)',
};

export default function GestaoConcessionarias() {
  const [lista, setLista] = useState<Concessionaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');

  const [editando, setEditando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [formTipo, setFormTipo] = useState<string>('');
  const [formDestino, setFormDestino] = useState('');
  const [formObs, setFormObs] = useState('');
  const [formAtivo, setFormAtivo] = useState(false);
  const [formEstados, setFormEstados] = useState('');

  const [criando, setCriando] = useState(false);
  const [criandoSalvando, setCriandoSalvando] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoRegulador, setNovoRegulador] = useState('');
  const [novaEsfera, setNovaEsfera] = useState('FEDERAL');
  const [novosEstados, setNovosEstados] = useState('');

  async function carregar() {
    try {
      const resposta = await fetch('/api/concessionaires');
      if (resposta.ok) setLista(await resposta.json());
      else setErro('Não foi possível carregar as concessionárias.');
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirCriacao() {
    setErro('');
    setAviso('');
    setEditando(null);
    setCriando(true);
    setNovoNome('');
    setNovoRegulador('');
    setNovaEsfera('FEDERAL');
    setNovosEstados('');
  }

  async function criar() {
    setErro('');
    setAviso('');
    setCriandoSalvando(true);

    try {
      const resposta = await fetch('/api/concessionaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: novoNome.trim(),
          regulador: novoRegulador.trim(),
          esfera: novaEsfera,
          estados: novosEstados.trim() || undefined,
        }),
      });

      const corpo = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível criar a concessionária.');
        return;
      }

      setAviso(
        `"${corpo.name}" criada. Ainda não recebe solicitações reais — use ` +
          '"Editar" para mapear um canal (ex: seu próprio e-mail) antes de testar.'
      );
      setCriando(false);
      await carregar();
    } catch {
      setErro('Falha de conexão ao criar.');
    } finally {
      setCriandoSalvando(false);
    }
  }

  function abrirEdicao(c: Concessionaria) {
    setErro('');
    setAviso('');
    setCriando(false);
    setEditando(c.id);
    setFormTipo(c.tipoCanal ?? '');
    setFormDestino(c.canalIsentos ?? '');
    setFormObs(c.observacoes ?? '');
    setFormAtivo(c.ativoParaCadastro);
    setFormEstados(format_estados(c.estados));
  }

  async function salvar(id: string) {
    setErro('');
    setAviso('');
    setSalvando(true);

    try {
      const resposta = await fetch(`/api/concessionaires/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoCanal: formTipo || null,
          canalIsentos: formDestino.trim() || null,
          observacoes: formObs.trim() || null,
          ativoParaCadastro: formAtivo,
          estados: formEstados.trim(),
        }),
      });

      const corpo = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível salvar.');
        return;
      }

      setAviso(`Canal de ${corpo.name} atualizado.`);
      setEditando(null);
      await carregar();
    } catch {
      setErro('Falha de conexão ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const contagens = useMemo(
    () =>
      lista.reduce<Record<string, number>>((acc, c) => {
        const chave = c.tipoCanal ?? 'SEM_CANAL';
        acc[chave] = (acc[chave] ?? 0) + 1;
        return acc;
      }, {}),
    [lista]
  );

  if (carregando) {
    return <p className="text-paper-dim">Carregando concessionárias...</p>;
  }

  const termo = busca.trim().toLowerCase();
  const filtradas = lista.filter(c => {
    const casaBusca =
      !termo ||
      c.name.toLowerCase().includes(termo) ||
      (c.regulador ?? '').toLowerCase().includes(termo) ||
      format_estados(c.estados).toLowerCase().includes(termo);

    const casaCanal =
      !filtroCanal ||
      (filtroCanal === 'SEM_CANAL' ? !c.tipoCanal : c.tipoCanal === filtroCanal);

    return casaBusca && casaCanal;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-paper">Gestão de Concessionárias</h1>
          <p className="mt-1 text-sm text-paper-dim">
            Canais de isenção mapeados e situação de cada concessionária
          </p>
        </div>
        <Button onClick={abrirCriacao} disabled={criando}>
          + Nova concessionária
        </Button>
      </div>

      {erro && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          {erro}
        </div>
      )}

      {aviso && (
        <div className="rounded border border-green/40 bg-green/10 p-3 text-sm text-paper">
          {aviso}
        </div>
      )}

      {criando && (
        <Card>
          <CardBody>
            <div className="space-y-3 rounded border border-green/30 bg-ink-700/40 p-4">
              <p className="font-medium text-paper">Nova concessionária</p>
              <p className="text-xs text-paper-dim">
                Fica inativa para cadastro até você mapear um canal em &quot;Editar&quot; —
                use isso para uma concessionária de teste sem afetar as reais.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-paper-dim">Nome</label>
                  <input
                    type="text"
                    value={novoNome}
                    onChange={e => setNovoNome(e.target.value)}
                    placeholder="ex: Concessionária Teste"
                    className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-paper-dim">Regulador</label>
                  <input
                    type="text"
                    value={novoRegulador}
                    onChange={e => setNovoRegulador(e.target.value)}
                    placeholder="ex: ANTT, ARTESP, teste"
                    className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-paper-dim">Esfera</label>
                  <select
                    value={novaEsfera}
                    onChange={e => setNovaEsfera(e.target.value)}
                    className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
                  >
                    <option value="FEDERAL">Federal</option>
                    <option value="ESTADUAL">Estadual</option>
                    <option value="MUNICIPAL">Municipal</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-paper-dim">
                    Estados (opcional)
                  </label>
                  <input
                    type="text"
                    value={novosEstados}
                    onChange={e => setNovosEstados(e.target.value)}
                    placeholder="ex: SP,RJ"
                    className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={criar}
                  disabled={
                    criandoSalvando || novoNome.trim().length < 3 || novoRegulador.trim().length < 2
                  }
                  size="sm"
                >
                  {criandoSalvando ? 'Criando...' : 'Criar'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCriando(false)}
                  disabled={criandoSalvando}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-4">
        {[
          { rotulo: 'Automatizáveis por e-mail', valor: contagens.EMAIL ?? 0, cor: 'text-green-400' },
          {
            rotulo: 'Via portal',
            valor: (contagens.PORTAL_WEB ?? 0) + (contagens.PORTAL_MAIS_ATENDIMENTO ?? 0),
            cor: 'text-blue-400',
          },
          { rotulo: 'Tratativa manual', valor: contagens.MANUAL ?? 0, cor: 'text-amber-400' },
          { rotulo: 'Canal não mapeado', valor: contagens.SEM_CANAL ?? 0, cor: 'text-paper-dim' },
        ].map(item => (
          <Card key={item.rotulo}>
            <CardBody className="py-6 text-center">
              <div className={`mb-2 text-3xl font-bold ${item.cor}`}>{item.valor}</div>
              <p className="text-sm text-paper-dim">{item.rotulo}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por nome, regulador ou estado..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="flex-1 rounded border border-border bg-input px-3 py-2 text-paper placeholder:text-paper-dim"
            />
            <select
              value={filtroCanal}
              onChange={e => setFiltroCanal(e.target.value)}
              className="rounded border border-border bg-input px-3 py-2 text-paper"
            >
              <option value="">Todos os canais</option>
              <option value="EMAIL">E-mail</option>
              <option value="PORTAL_WEB">Portal web</option>
              <option value="PORTAL_MAIS_ATENDIMENTO">Portal +Atendimento</option>
              <option value="MANUAL">Manual</option>
              <option value="SEM_CANAL">Não mapeado</option>
            </select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {filtradas.length} de {lista.length}
          </h2>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Concessionária</TableCell>
                  <TableCell>Regulador</TableCell>
                  <TableCell>Estados</TableCell>
                  <TableCell>Canal</TableCell>
                  <TableCell>Destino</TableCell>
                  <TableCell>Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtradas.map(c =>
                  editando === c.id ? (
                    <TableRow key={c.id}>
                      <TableCell colSpan={6}>
                        <div className="space-y-3 rounded border border-green/30 bg-ink-700/40 p-4">
                          <p className="font-medium text-paper">{c.name}</p>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs text-paper-dim">
                                Tipo de canal
                              </label>
                              <select
                                value={formTipo}
                                onChange={e => setFormTipo(e.target.value)}
                                className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
                              >
                                <option value="">Não mapeado</option>
                                <option value="EMAIL">E-mail (envio automático)</option>
                                <option value="PORTAL_WEB">Portal web</option>
                                <option value="PORTAL_MAIS_ATENDIMENTO">
                                  Portal +Atendimento
                                </option>
                                <option value="MANUAL">Manual</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs text-paper-dim">
                                Destino
                              </label>
                              <input
                                type="text"
                                value={formDestino}
                                onChange={e => setFormDestino(e.target.value)}
                                placeholder={DICA_DESTINO[formTipo] ?? 'e-mail ou endereço do portal'}
                                className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-paper-dim">
                              Estados
                            </label>
                            <input
                              type="text"
                              value={formEstados}
                              onChange={e => setFormEstados(e.target.value)}
                              placeholder="ex: SP, RJ"
                              className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
                            />
                            {!formEstados.trim() && (
                              <p className="mt-1 text-xs text-paper-dim">
                                Sem estado, esta concessionária não aparece em nenhum
                                filtro por estado — inclusive em &quot;Solicitar Isenção&quot;.
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-paper-dim">
                              Observações
                            </label>
                            <input
                              type="text"
                              value={formObs}
                              onChange={e => setFormObs(e.target.value)}
                              placeholder="ex: também aceita formulário no site"
                              className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
                            />
                          </div>

                          {formTipo === 'EMAIL' && (
                            <p className="text-xs text-green">
                              Com canal de e-mail, as solicitações desta concessionária
                              passam a ser enviadas automaticamente.
                            </p>
                          )}

                          <label className="flex items-center gap-2 text-sm text-paper">
                            <input
                              type="checkbox"
                              checked={formAtivo}
                              onChange={e => setFormAtivo(e.target.checked)}
                              className="h-4 w-4 rounded accent-green"
                            />
                            Habilitada para receber solicitações reais
                          </label>
                          {!formAtivo && (
                            <p className="text-xs text-paper-dim">
                              Desmarcada, esta concessionária não aparece para os
                              operadores em &quot;Solicitar Isenção&quot; — é o estado
                              padrão de uma concessionária recém-criada.
                            </p>
                          )}

                          <div className="flex gap-2">
                            <Button onClick={() => salvar(c.id)} disabled={salvando} size="sm">
                              {salvando ? 'Salvando...' : 'Salvar'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditando(null)}
                              disabled={salvando}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-paper-dim">{c.regulador}</TableCell>
                      <TableCell className="text-sm">
                        {format_estados(c.estados) || '—'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            COR_CANAL[c.tipoCanal ?? ''] ?? 'bg-gray-900/20 text-gray-400'
                          }`}
                        >
                          {ROTULO_CANAL[c.tipoCanal ?? ''] ?? 'Não mapeado'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm text-paper-dim">
                        <span className="block truncate" title={c.observacoes ?? undefined}>
                          {c.canalIsentos ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => abrirEdicao(c)}
                          className="rounded px-2 py-1 text-sm text-green hover:bg-green/10"
                        >
                          Editar
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      <Link href="/dashboard/admin">
        <Button variant="secondary">Voltar</Button>
      </Link>
    </div>
  );
}
