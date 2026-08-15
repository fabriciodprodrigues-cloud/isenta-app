'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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
  // Fora dos seis da especificação, e opcional de propósito: um órgão que só
  // lida com concessionárias de canal por e-mail não precisa de conta em
  // portal nenhum. Por isso não entra nas pendências de identidade.
  'Portais',
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
              accountId={accountId}
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
          {passo === 7 && <PassoPortais accountId={accountId} />}
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

interface ResumoCredencial {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  senhaDefinida: boolean;
}

/**
 * Atalhos para os provedores mais comuns em órgãos públicos.
 *
 * São ponto de partida, não verdade absoluta: alguns órgãos usam servidor
 * próprio ou porta alternativa. O teste de conexão é que confirma.
 */
const PROVEDORES: Record<
  string,
  { rotulo: string; host: string; port: number; secure: boolean; nota?: string }
> = {
  google: {
    rotulo: 'Google Workspace / Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    nota: 'Com verificação em duas etapas ativa, é preciso gerar uma "senha de app" — a senha da conta não funciona no SMTP.',
  },
  microsoft: {
    rotulo: 'Microsoft 365 / Outlook',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    nota: 'O administrador precisa manter a autenticação SMTP habilitada para a caixa; ela vem desativada por padrão em muitos tenants.',
  },
  locaweb: {
    rotulo: 'Locaweb',
    host: 'email-ssl.com.br',
    port: 465,
    secure: true,
  },
  outro: {
    rotulo: 'Outro / servidor próprio',
    host: '',
    port: 587,
    secure: false,
    nota: 'Peça ao TI o servidor de saída, a porta e se usa SSL/TLS direto.',
  },
};

function PassoEmail({
  orgao,
  accountId,
  salvando,
  onSalvar,
  onVerificar,
}: {
  orgao: Orgao;
  accountId: string;
  salvando: boolean;
  onSalvar: (campos: Record<string, unknown>) => Promise<boolean>;
  onVerificar: () => void;
}) {
  const [email, setEmail] = useState(orgao.emailIsencao ?? '');
  const [metodo, setMetodo] = useState(orgao.metodoAcessoEmail ?? '');

  const [credencial, setCredencial] = useState<ResumoCredencial | null>(null);
  const [cofreOk, setCofreOk] = useState(true);
  const [host, setHost] = useState('');
  const [porta, setPorta] = useState('587');
  const [seguro, setSeguro] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [testando, setTestando] = useState(false);
  const [erroSmtp, setErroSmtp] = useState('');
  const [okSmtp, setOkSmtp] = useState('');
  const [provedor, setProvedor] = useState('');

  function aplicarProvedor(chave: string) {
    setProvedor(chave);
    const preset = PROVEDORES[chave];
    if (!preset) return;

    if (preset.host) setHost(preset.host);
    setPorta(String(preset.port));
    setSeguro(preset.secure);

    // O usuário do SMTP costuma ser a própria caixa de isenção.
    if (!usuario && email) setUsuario(email);
  }

  async function carregarCredencial() {
    const resposta = await fetch(
      `/api/accounts/${accountId}/identidade/credencial`
    );
    if (!resposta.ok) return;
    const dados = await resposta.json();
    setCofreOk(dados.cofre !== false);
    if (dados.configurada && dados.credencial) {
      setCredencial(dados.credencial);
      setHost(dados.credencial.host);
      setPorta(String(dados.credencial.port));
      setSeguro(dados.credencial.secure);
      setUsuario(dados.credencial.user);
    }
  }

  useEffect(() => {
    carregarCredencial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function salvarCredencial() {
    setErroSmtp('');
    setOkSmtp('');
    setTestando(true);

    try {
      const resposta = await fetch(
        `/api/accounts/${accountId}/identidade/credencial`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host,
            port: Number(porta),
            secure: seguro,
            user: usuario,
            pass: senha || undefined,
          }),
        }
      );

      const corpo = await resposta.json().catch(() => null);

      if (resposta.ok) {
        setOkSmtp(corpo?.message ?? 'Credencial guardada.');
        setSenha('');
        await carregarCredencial();
      } else {
        setErroSmtp(
          corpo?.detalhe ? `${corpo.error} ${corpo.detalhe}` : corpo?.error ?? 'Falhou.'
        );
      }
    } catch {
      setErroSmtp('Falha de conexão.');
    } finally {
      setTestando(false);
    }
  }

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

      {metodo === 'CREDENCIAL' && (
        <div className="space-y-4 rounded border border-white/10 bg-ink-700/40 p-4">
          <div>
            <p className="font-medium text-paper">Credencial SMTP da caixa</p>
            <p className="mt-1 text-sm text-paper-dim">
              É por aqui que os ofícios sairão. Como a mensagem parte do servidor
              do próprio órgão, ela passa pelo SPF e DKIM do domínio deles — não
              é preciso alterar DNS.
            </p>
          </div>

          {!cofreOk && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
              O cofre de segredos não está configurado no servidor
              (ENCRYPTION_KEY ausente). Sem ele a senha não pode ser guardada com
              segurança.
            </div>
          )}

          {credencial && (
            <p className="text-sm text-green">
              Configurada: {credencial.user} em {credencial.host}:{credencial.port}
              {credencial.secure ? ' (TLS)' : ''}
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs text-paper-dim">
              Provedor de e-mail do órgão
            </label>
            <select
              value={provedor}
              onChange={e => aplicarProvedor(e.target.value)}
              className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
            >
              <option value="">Selecione para preencher automaticamente</option>
              {Object.entries(PROVEDORES).map(([chave, p]) => (
                <option key={chave} value={chave}>
                  {p.rotulo}
                </option>
              ))}
            </select>
            {provedor && PROVEDORES[provedor]?.nota && (
              <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-paper-dim">
                {PROVEDORES[provedor].nota}
              </p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-paper-dim">Servidor</label>
              <input
                type="text"
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="smtp.orgao.gov.br"
                className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-paper-dim">Porta</label>
              <input
                type="number"
                value={porta}
                onChange={e => setPorta(e.target.value)}
                className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
              />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-paper">
                <input
                  type="checkbox"
                  checked={seguro}
                  onChange={e => setSeguro(e.target.checked)}
                  className="h-4 w-4 rounded accent-green"
                />
                TLS direto
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-paper-dim">Usuário</label>
              <input
                type="text"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                placeholder="isencao@orgao.gov.br"
                className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-paper-dim">
                Senha {credencial?.senhaDefinida && '(em branco mantém a atual)'}
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
              />
            </div>
          </div>

          {erroSmtp && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
              {erroSmtp}
            </div>
          )}
          {okSmtp && (
            <div className="rounded border border-green/40 bg-green/10 p-3 text-sm text-paper">
              {okSmtp}
            </div>
          )}

          <div>
            <Button disabled={testando || !cofreOk} onClick={salvarCredencial}>
              {testando ? 'Testando conexão...' : 'Testar e guardar'}
            </Button>
            <p className="mt-2 text-xs text-slate">
              A conexão é testada antes de guardar. A senha é cifrada e não volta
              a ser exibida — nem para você.
            </p>
          </div>
        </div>
      )}
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

interface DefinicaoPortal {
  chave: string;
  nome: string;
  url: string;
  concessionarias: string[];
  automatizado: boolean;
  instrucaoConta: string;
}

interface CredencialPortal {
  id: string;
  portal: string;
  usuario: string;
  updatedAt: string;
}

function PassoPortais({ accountId }: { accountId: string }) {
  const [portais, setPortais] = useState<DefinicaoPortal[]>([]);
  const [credenciais, setCredenciais] = useState<CredencialPortal[]>([]);
  const [cofreOk, setCofreOk] = useState(true);
  const [carregando, setCarregando] = useState(true);

  const [editando, setEditando] = useState<string | null>(null);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  async function carregar() {
    try {
      const resposta = await fetch(`/api/accounts/${accountId}/portais`);
      if (!resposta.ok) {
        setErro('Não foi possível carregar os portais.');
        return;
      }
      const dados = await resposta.json();
      setPortais(dados.portais);
      setCredenciais(dados.credenciais);
      setCofreOk(dados.cofre !== false);
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

  function abrirEdicao(chave: string) {
    const atual = credenciais.find(c => c.portal === chave);
    setEditando(chave);
    setUsuario(atual?.usuario ?? '');
    setSenha('');
    setErro('');
    setAviso('');
  }

  async function salvar(chave: string) {
    setErro('');
    setAviso('');
    setSalvando(true);

    try {
      const resposta = await fetch(`/api/accounts/${accountId}/portais`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal: chave, usuario, senha: senha || undefined }),
      });

      const corpo = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível salvar.');
        return;
      }

      setAviso(corpo?.aviso ?? 'Credencial guardada.');
      setEditando(null);
      setSenha('');
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(chave: string) {
    if (!confirm('Remover a credencial deste portal?')) return;

    await fetch(`/api/accounts/${accountId}/portais?portal=${chave}`, {
      method: 'DELETE',
    });
    await carregar();
  }

  if (carregando) return <p className="text-paper-dim">Carregando portais...</p>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-paper-dim">
        Concessionárias que só aceitam solicitação por portal exigem uma conta
        do órgão no site delas. Este passo é opcional: um órgão que só lida com
        canais por e-mail não precisa dele.
      </p>

      {!cofreOk && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          O cofre de segredos não está configurado no servidor (ENCRYPTION_KEY
          ausente).
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

      {portais.map(portal => {
        const credencial = credenciais.find(c => c.portal === portal.chave);
        const aberto = editando === portal.chave;

        return (
          <div
            key={portal.chave}
            className="space-y-3 rounded-lg border border-white/10 bg-ink-700/40 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-paper">{portal.nome}</p>
                <p className="mt-1 text-xs text-paper-dim">
                  Atende: {portal.concessionarias.join(', ')}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!portal.automatizado && (
                  <Badge variant="default" size="sm">
                    Robô ainda não cobre
                  </Badge>
                )}
                {credencial ? (
                  <Badge variant="success" size="sm">
                    Conta cadastrada
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    Sem conta
                  </Badge>
                )}
              </div>
            </div>

            {credencial && !aberto && (
              <p className="text-sm text-green">{credencial.usuario}</p>
            )}

            {aberto ? (
              <div className="space-y-3">
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-paper-dim">
                  {portal.instrucaoConta}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-paper-dim">
                      E-mail da conta no portal
                    </label>
                    <input
                      type="email"
                      value={usuario}
                      onChange={e => setUsuario(e.target.value)}
                      className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-paper-dim">
                      Senha {credencial && '(em branco mantém a atual)'}
                    </label>
                    <input
                      type="password"
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      autoComplete="new-password"
                      className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
                    />
                  </div>
                </div>

                <p className="text-xs text-slate">
                  A senha é cifrada e não volta a ser exibida. Ela não é testada
                  agora: fazer login de verificação a cada salvamento arriscaria
                  bloquear a conta do órgão por tentativas repetidas — o robô
                  reporta a falha na primeira execução.
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={salvando || !cofreOk}
                    onClick={() => salvar(portal.chave)}
                  >
                    {salvando ? 'Salvando...' : 'Guardar credencial'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditando(null)}
                    disabled={salvando}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => abrirEdicao(portal.chave)}
                >
                  {credencial ? 'Alterar' : 'Cadastrar conta'}
                </Button>
                {credencial && (
                  <button
                    type="button"
                    onClick={() => remover(portal.chave)}
                    className="rounded px-2 py-1 text-sm text-slate hover:bg-ink-700"
                  >
                    Remover
                  </button>
                )}
                <a
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-2 py-1 text-sm text-green hover:bg-green/10"
                >
                  Abrir portal
                </a>
              </div>
            )}
          </div>
        );
      })}
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
