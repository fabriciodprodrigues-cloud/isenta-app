'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  ROTULO_METODO_EMAIL,
  ROTULO_ASSINATURA,
  ROTULO_PODER,
  type Pendencia,
} from '@/lib/identidade-envio';

interface Autorizacao {
  id: string;
  arquivoUrl: string | null;
  poderes: string[];
  assinadoEm: string | null;
  validoAte: string | null;
  ativo: boolean;
}

interface Orgao {
  id: string;
  name: string;
  razaoSocial: string | null;
  cnpj: string;
  address: string;
  numero: string | null;
  bairro: string | null;
  city: string;
  state: string;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
  responsibleRole: string | null;
  emailIsencao: string | null;
  metodoAcessoEmail: string | null;
  emailVerificado: boolean;
  timbreUrl: string | null;
  cabecalhoTexto: string | null;
  cidadeEmissao: string | null;
  metodoAssinatura: string | null;
  proximoNumeroOficio: number;
  autorizacao: Autorizacao | null;
}

const PASSOS = [
  'Dados do órgão',
  'Endereço',
  'E-mail de isenção',
  'Papel timbrado',
  'Assinatura',
  'Autorização',
];

export default function OnboardingOrgao() {
  const params = useParams();
  const accountId = String(params.accountId);

  const [orgao, setOrgao] = useState<Orgao | null>(null);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [completa, setCompleta] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [passo, setPasso] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const inputTimbre = useRef<HTMLInputElement>(null);

  async function carregar() {
    try {
      const resposta = await fetch(`/api/accounts/${accountId}/identidade`);
      if (!resposta.ok) {
        setErro('Não foi possível carregar o órgão.');
        return;
      }
      const dados = await resposta.json();
      setOrgao(dados.orgao);
      setPendencias(dados.identidade.pendencias);
      setCompleta(dados.identidade.completa);
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function salvar(campos: Record<string, unknown>) {
    setErro('');
    setAviso('');
    setSalvando(true);

    try {
      const resposta = await fetch(`/api/accounts/${accountId}/identidade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      });

      const corpo = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível salvar.');
        return false;
      }

      if (corpo?.avisoEmailReverificar) {
        setAviso('O e-mail mudou, então a verificação anterior deixou de valer.');
      }

      await carregar();
      return true;
    } catch {
      setErro('Falha de conexão ao salvar.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function enviarVerificacao() {
    setErro('');
    setAviso('');
    setSalvando(true);

    try {
      const resposta = await fetch(
        `/api/accounts/${accountId}/identidade/verificar`,
        { method: 'POST' }
      );
      const corpo = await resposta.json().catch(() => null);

      if (resposta.ok) setAviso(corpo?.message ?? 'Link enviado.');
      else setErro(corpo?.error ?? 'Não foi possível enviar.');
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarTimbre(arquivo: File) {
    setErro('');
    setAviso('');
    setSalvando(true);

    const dados = new FormData();
    dados.append('file', arquivo);

    try {
      const resposta = await fetch(
        `/api/accounts/${accountId}/identidade/timbre`,
        { method: 'POST', body: dados }
      );
      const corpo = await resposta.json().catch(() => null);

      if (resposta.ok) {
        setAviso('Papel timbrado enviado.');
        await carregar();
      } else {
        setErro(corpo?.error ?? 'Não foi possível enviar o timbre.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
      if (inputTimbre.current) inputTimbre.current.value = '';
    }
  }

  async function salvarAutorizacao(dados: {
    poderes: string[];
    assinadoEm: string | null;
    validoAte: string | null;
    arquivoUrl: string | null;
    ativo: boolean;
  }) {
    setErro('');
    setAviso('');
    setSalvando(true);

    try {
      const resposta = await fetch(`/api/accounts/${accountId}/autorizacao`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });

      const corpo = await resposta.json().catch(() => null);

      if (resposta.ok) {
        setAviso('Termo de autorização salvo.');
        await carregar();
      } else {
        setErro(corpo?.error ?? 'Não foi possível salvar o termo.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-paper-dim">Carregando...</p>;
  if (!orgao) {
    return (
      <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-300">
        {erro || 'Órgão não encontrado.'}
      </div>
    );
  }

  const pendentesDoPasso = (n: number) => pendencias.filter(p => p.passo === n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Identidade de envio</h1>
        <p className="mt-1 text-sm text-paper-dim">
          {orgao.name} — configuração necessária para o órgão enviar solicitações
        </p>
      </div>

      {completa ? (
        <div className="rounded-lg border border-green/40 bg-green/10 p-4 text-sm text-paper">
          <strong>Órgão pronto para operar.</strong> Todas as solicitações sairão
          com a identidade oficial do órgão.
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="mb-2 font-medium text-amber-400">
            Este órgão ainda não pode enviar solicitações.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-paper-dim">
            {pendencias.map(p => (
              <li key={p.campo}>
                {p.descricao}{' '}
                <button
                  type="button"
                  onClick={() => setPasso(p.passo)}
                  className="text-green hover:underline"
                >
                  (passo {p.passo})
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <div className="flex flex-wrap gap-2">
        {PASSOS.map((rotulo, i) => {
          const n = i + 1;
          const faltando = pendentesDoPasso(n).length;
          const ativo = passo === n;
          return (
            <button
              key={rotulo}
              type="button"
              onClick={() => setPasso(n)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                ativo
                  ? 'border-green bg-green/10 text-paper'
                  : 'border-white/10 text-paper-dim hover:bg-ink-700'
              }`}
            >
              <span className="mr-2 font-mono text-xs">{n}</span>
              {rotulo}
              {faltando > 0 && <span className="ml-2 text-amber-400">•</span>}
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {passo}. {PASSOS[passo - 1]}
          </h2>
        </CardHeader>
        <CardBody>
          {passo === 1 && <PassoDados orgao={orgao} />}
          {passo === 2 && <PassoEndereco orgao={orgao} />}
          {passo === 3 && (
            <PassoEmail
              orgao={orgao}
              salvando={salvando}
              onSalvar={salvar}
              onVerificar={enviarVerificacao}
            />
          )}
          {passo === 4 && (
            <PassoTimbre
              orgao={orgao}
              accountId={accountId}
              salvando={salvando}
              inputRef={inputTimbre}
              onArquivo={enviarTimbre}
              onSalvar={salvar}
            />
          )}
          {passo === 5 && (
            <PassoAssinatura orgao={orgao} salvando={salvando} onSalvar={salvar} />
          )}
          {passo === 6 && (
            <PassoAutorizacao
              orgao={orgao}
              salvando={salvando}
              onSalvar={salvarAutorizacao}
            />
          )}
        </CardBody>
      </Card>

      <div className="flex gap-3">
        <Link href="/dashboard/admin/orgaos">
          <Button variant="secondary">Voltar para Órgãos</Button>
        </Link>
        <Link href={`/dashboard/admin/orgaos/${accountId}/usuarios`}>
          <Button variant="secondary">Usuários deste órgão</Button>
        </Link>
      </div>
    </div>
  );
}

/* ---------- Passos ---------- */

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <div className="text-xs text-paper-dim">{rotulo}</div>
      <div className="text-paper">{valor || '—'}</div>
    </div>
  );
}

function PassoDados({ orgao }: { orgao: Orgao }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-paper-dim">
        Dados institucionais, informados no cadastro do órgão.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Nome" valor={orgao.name} />
        <Campo rotulo="Razão social" valor={orgao.razaoSocial} />
        <Campo rotulo="CNPJ" valor={orgao.cnpj} />
        <Campo rotulo="Telefone" valor={orgao.telefone || orgao.responsiblePhone} />
        <Campo rotulo="E-mail geral" valor={orgao.email || orgao.responsibleEmail} />
      </div>
      <p className="text-xs text-slate">
        Para alterar, use a edição do órgão.
      </p>
    </div>
  );
}

function PassoEndereco({ orgao }: { orgao: Orgao }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-paper-dim">
        Endereço usado no cabeçalho do ofício.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Logradouro" valor={orgao.address} />
        <Campo rotulo="Número" valor={orgao.numero} />
        <Campo rotulo="Bairro" valor={orgao.bairro} />
        <Campo rotulo="CEP" valor={orgao.cep} />
        <Campo rotulo="Cidade" valor={orgao.city} />
        <Campo rotulo="UF" valor={orgao.state} />
      </div>
    </div>
  );
}

function PassoEmail({
  orgao,
  salvando,
  onSalvar,
  onVerificar,
}: {
  orgao: Orgao;
  salvando: boolean;
  onSalvar: (campos: Record<string, unknown>) => Promise<boolean>;
  onVerificar: () => void;
}) {
  const [email, setEmail] = useState(orgao.emailIsencao ?? '');
  const [metodo, setMetodo] = useState(orgao.metodoAcessoEmail ?? '');

  return (
    <div className="space-y-5">
      <p className="text-sm text-paper-dim">
        Caixa institucional que aparecerá como remetente dos ofícios.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-paper">E-mail de isenção</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="isencao@orgao.gov.br"
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-paper">Método de acesso</label>
          <select
            value={metodo}
            onChange={e => setMetodo(e.target.value)}
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          >
            <option value="">Selecione</option>
            {Object.entries(ROTULO_METODO_EMAIL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {metodo === 'ENCAMINHAMENTO' && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-paper-dim">
          Encaminhamento permite <strong className="text-paper">receber</strong> as
          respostas, mas não enviar como o órgão. Para os portais e para o
          remetente do ofício, será preciso delegação ou credencial.
        </div>
      )}

      <div className="rounded border border-white/10 bg-ink-700/40 p-4 text-sm text-paper-dim">
        <p className="mb-2 font-medium text-paper">Verificação</p>
        {orgao.emailVerificado ? (
          <p className="text-green">
            Caixa verificada — alguém do órgão confirmou o acesso.
          </p>
        ) : (
          <p>
            Enviamos um link para a caixa informada. A verificação só é concluída
            quando alguém do órgão clicar nele — um botão que apenas marcasse
            &quot;verificado&quot; aqui não provaria acesso algum.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          disabled={salvando}
          onClick={() =>
            onSalvar({
              emailIsencao: email || null,
              metodoAcessoEmail: metodo || null,
            })
          }
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button
          variant="secondary"
          disabled={salvando || !orgao.emailIsencao}
          onClick={onVerificar}
        >
          {orgao.emailVerificado ? 'Verificar novamente' : 'Enviar verificação'}
        </Button>
      </div>
    </div>
  );
}

function PassoTimbre({
  orgao,
  accountId,
  salvando,
  inputRef,
  onArquivo,
  onSalvar,
}: {
  orgao: Orgao;
  accountId: string;
  salvando: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onArquivo: (arquivo: File) => void;
  onSalvar: (campos: Record<string, unknown>) => Promise<boolean>;
}) {
  const [cabecalho, setCabecalho] = useState(orgao.cabecalhoTexto ?? '');
  const [cidade, setCidade] = useState(orgao.cidadeEmissao ?? orgao.city ?? '');

  return (
    <div className="space-y-5">
      <p className="text-sm text-paper-dim">
        O timbre aparece no topo do ofício. Envie em PNG ou JPG, até 4 MB —
        clientes de e-mail não renderizam PDF embutido.
      </p>

      {orgao.timbreUrl && (
        <div className="rounded border border-white/10 bg-ink-700/40 p-4">
          <p className="mb-2 text-xs text-paper-dim">Timbre atual</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/accounts/${accountId}/identidade/timbre`}
            alt="Papel timbrado"
            className="max-h-32 rounded bg-white p-2"
          />
        </div>
      )}

      <div>
        <label className="cursor-pointer rounded bg-green px-4 py-2 text-sm font-medium text-ink-900 hover:bg-green/90">
          {orgao.timbreUrl ? 'Substituir timbre' : 'Enviar timbre'}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            disabled={salvando}
            onChange={e => {
              const arquivo = e.target.files?.[0];
              if (arquivo) onArquivo(arquivo);
            }}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-paper">
            Linha de cabeçalho (opcional)
          </label>
          <input
            type="text"
            value={cabecalho}
            onChange={e => setCabecalho(e.target.value)}
            placeholder="ex: Secretaria de Administração"
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-paper">Cidade de emissão</label>
          <input
            type="text"
            value={cidade}
            onChange={e => setCidade(e.target.value)}
            placeholder="ex: Chapadão do Sul/MS"
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          />
        </div>
      </div>

      <Button
        disabled={salvando}
        onClick={() =>
          onSalvar({
            cabecalhoTexto: cabecalho || null,
            cidadeEmissao: cidade || null,
          })
        }
      >
        {salvando ? 'Salvando...' : 'Salvar'}
      </Button>
    </div>
  );
}

function PassoAssinatura({
  orgao,
  salvando,
  onSalvar,
}: {
  orgao: Orgao;
  salvando: boolean;
  onSalvar: (campos: Record<string, unknown>) => Promise<boolean>;
}) {
  const [metodo, setMetodo] = useState(orgao.metodoAssinatura ?? '');
  const [nome, setNome] = useState(orgao.responsibleName ?? '');
  const [cargo, setCargo] = useState(orgao.responsibleRole ?? '');

  return (
    <div className="space-y-5">
      <p className="text-sm text-paper-dim">
        Quem assina o ofício em nome do órgão.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm text-paper">Método</label>
          <select
            value={metodo}
            onChange={e => setMetodo(e.target.value)}
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          >
            <option value="">Selecione</option>
            {Object.entries(ROTULO_ASSINATURA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-paper">Nome de quem assina</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-paper">Cargo</label>
          <input
            type="text"
            value={cargo}
            onChange={e => setCargo(e.target.value)}
            placeholder="ex: Diretor Administrativo"
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          />
        </div>
      </div>

      <div className="rounded border border-white/10 bg-ink-700/40 p-3 text-xs text-paper-dim">
        O ofício sai hoje com a assinatura por extenso, nome e cargo. A assinatura
        digital gov.br/ICP ainda não está integrada — a escolha aqui registra a
        intenção do órgão.
      </div>

      <Button
        disabled={salvando}
        onClick={() =>
          onSalvar({
            metodoAssinatura: metodo || null,
            responsibleName: nome || undefined,
            responsibleRole: cargo || null,
          })
        }
      >
        {salvando ? 'Salvando...' : 'Salvar'}
      </Button>
    </div>
  );
}

function PassoAutorizacao({
  orgao,
  salvando,
  onSalvar,
}: {
  orgao: Orgao;
  salvando: boolean;
  onSalvar: (dados: {
    poderes: string[];
    assinadoEm: string | null;
    validoAte: string | null;
    arquivoUrl: string | null;
    ativo: boolean;
  }) => void;
}) {
  const termo = orgao.autorizacao;

  const [poderes, setPoderes] = useState<string[]>(
    termo?.poderes ?? Object.keys(ROTULO_PODER)
  );
  const [assinadoEm, setAssinadoEm] = useState(
    termo?.assinadoEm ? termo.assinadoEm.slice(0, 10) : ''
  );
  const [validoAte, setValidoAte] = useState(
    termo?.validoAte ? termo.validoAte.slice(0, 10) : ''
  );
  const [arquivoUrl, setArquivoUrl] = useState(termo?.arquivoUrl ?? '');
  const [ativo, setAtivo] = useState(termo?.ativo ?? false);

  function alternarPoder(valor: string) {
    setPoderes(atual =>
      atual.includes(valor) ? atual.filter(p => p !== valor) : [...atual, valor]
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-paper-dim">
        Documento em que o órgão autoriza a Isenta a agir em seu nome. Sem ele
        ativo, nenhuma solicitação é enviada.
      </p>

      <div>
        <label className="mb-2 block text-sm text-paper">Poderes concedidos</label>
        <div className="space-y-2">
          {Object.entries(ROTULO_PODER).map(([valor, rotulo]) => (
            <label key={valor} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={poderes.includes(valor)}
                onChange={() => alternarPoder(valor)}
                className="h-4 w-4 rounded accent-green"
              />
              <span className="text-sm text-paper">{rotulo}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm text-paper">Assinado em</label>
          <input
            type="date"
            value={assinadoEm}
            onChange={e => setAssinadoEm(e.target.value)}
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-paper">Válido até (opcional)</label>
          <input
            type="date"
            value={validoAte}
            onChange={e => setValidoAte(e.target.value)}
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-paper">Referência do arquivo</label>
          <input
            type="text"
            value={arquivoUrl}
            onChange={e => setArquivoUrl(e.target.value)}
            placeholder="link ou identificador do termo assinado"
            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded border border-white/10 bg-ink-700/40 p-4">
        <input
          type="checkbox"
          checked={ativo}
          onChange={e => setAtivo(e.target.checked)}
          className="mt-1 h-4 w-4 rounded accent-green"
        />
        <span className="text-sm">
          <span className="block font-medium text-paper">Termo ativo</span>
          <span className="text-paper-dim">
            Marque apenas após o órgão assinar. É esta marcação que libera o envio.
          </span>
        </span>
      </label>

      {termo?.validoAte && new Date(termo.validoAte) < new Date() && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          Este termo venceu. Renove a validade para o órgão voltar a operar.
        </div>
      )}

      <Button
        disabled={salvando}
        onClick={() =>
          onSalvar({
            poderes,
            assinadoEm: assinadoEm ? new Date(assinadoEm).toISOString() : null,
            validoAte: validoAte ? new Date(validoAte).toISOString() : null,
            arquivoUrl: arquivoUrl || null,
            ativo,
          })
        }
      >
        {salvando ? 'Salvando...' : 'Salvar termo'}
      </Button>
    </div>
  );
}
