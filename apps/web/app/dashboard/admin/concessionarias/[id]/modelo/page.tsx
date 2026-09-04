'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CAMPOS_ORGAO_CONHECIDOS, CAMPOS_VEICULO_CONHECIDOS } from '@/lib/modelo-documento-tipos';

type Tipo = 'GENERICO' | 'DOCX' | 'XLSX';

interface ModeloConfig {
  tipo: Tipo;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  codigoFormulario: string | null;
  mapeamentoCampos: any;
  formatoSaida: 'PDF' | 'MANTER_ORIGINAL';
  ativo: boolean;
}

const ROTULO_CAMPO_ORGAO: Record<string, string> = {
  responsavelNome: 'Nome do responsável',
  responsavelCpf: 'CPF do responsável',
  orgaoNome: 'Instituição / nome do órgão',
  orgaoCnpj: 'CNPJ do órgão',
  orgaoEndereco: 'Endereço',
  orgaoTelefone: 'Telefone',
  orgaoEmail: 'E-mail',
  data: 'Data da solicitação',
};

const ROTULO_CAMPO_VEICULO: Record<string, string> = {
  veiculo: 'Veículo (marca + modelo)',
  marca: 'Marca',
  modelo: 'Modelo',
  ano: 'Ano',
  placa: 'Placa',
  renavam: 'RENAVAM',
  tipo: 'Tipo (próprio/locado)',
  cor: 'Cor',
  cnpjCpf: 'CNPJ/CPF',
  observacao: 'Observação',
};

function mapeamentoVazio(tipo: Tipo) {
  if (tipo === 'DOCX') return { campos: {} };
  if (tipo === 'XLSX') return { campos: {}, tabelaVeiculos: { linhaInicial: 1, colunas: {} } };
  return null;
}

export default function ModeloDocumentoConcessionaria() {
  const params = useParams();
  const id = params.id as string;

  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [prevendo, setPrevendo] = useState(false);
  const [ativando, setAtivando] = useState(false);

  const [tipo, setTipo] = useState<Tipo>('GENERICO');
  const [arquivoUrl, setArquivoUrl] = useState<string | null>(null);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [codigoFormulario, setCodigoFormulario] = useState('');
  const [formatoSaida, setFormatoSaida] = useState<'PDF' | 'MANTER_ORIGINAL'>('PDF');
  const [ativo, setAtivo] = useState(false);
  const [camposDocx, setCamposDocx] = useState<Record<string, string>>({});
  const [camposXlsx, setCamposXlsx] = useState<Record<string, string>>({});
  const [linhaInicial, setLinhaInicial] = useState(1);
  const [colunasVeiculo, setColunasVeiculo] = useState<Record<string, string>>({});

  async function carregar() {
    try {
      const [respConcessionaria, respModelo] = await Promise.all([
        fetch(`/api/concessionaires/${id}`),
        fetch(`/api/concessionarias/${id}/modelo`),
      ]);

      if (respConcessionaria.ok) setNome((await respConcessionaria.json()).name);

      if (respModelo.ok) {
        const dados: ModeloConfig = await respModelo.json();
        setTipo(dados.tipo);
        setArquivoUrl(dados.arquivoUrl);
        setArquivoNome(dados.arquivoNome);
        setCodigoFormulario(dados.codigoFormulario ?? '');
        setFormatoSaida(dados.formatoSaida);
        setAtivo(dados.ativo);
        if (dados.tipo === 'DOCX') setCamposDocx(dados.mapeamentoCampos?.campos ?? {});
        if (dados.tipo === 'XLSX') {
          setCamposXlsx(dados.mapeamentoCampos?.campos ?? {});
          setLinhaInicial(dados.mapeamentoCampos?.tabelaVeiculos?.linhaInicial ?? 1);
          setColunasVeiculo(dados.mapeamentoCampos?.tabelaVeiculos?.colunas ?? {});
        }
      } else {
        setErro('Não foi possível carregar a configuração de modelo.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function mapeamentoAtual() {
    if (tipo === 'DOCX') return { campos: camposDocx };
    if (tipo === 'XLSX') return { campos: camposXlsx, tabelaVeiculos: { linhaInicial, colunas: colunasVeiculo } };
    return null;
  }

  function mudarTipo(novoTipo: Tipo) {
    if (novoTipo === tipo) return;
    const temConfig = arquivoUrl || Object.keys(camposDocx).length > 0 || Object.keys(camposXlsx).length > 0;
    if (temConfig) {
      const confirmar = window.confirm(
        'Trocar o tipo de documento zera o arquivo e o mapeamento configurados para esta concessionária. Continuar?'
      );
      if (!confirmar) return;
    }
    setTipo(novoTipo);
    setCamposDocx({});
    setCamposXlsx({});
    setLinhaInicial(1);
    setColunasVeiculo({});
  }

  async function salvarConfig() {
    setErro('');
    setAviso('');
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/concessionarias/${id}/modelo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          mapeamentoCampos: mapeamentoAtual(),
          codigoFormulario: codigoFormulario.trim() || null,
          formatoSaida,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível salvar.');
        return;
      }
      setAviso('Configuração salva.');
      await carregar();
    } catch {
      setErro('Falha de conexão ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarArquivo(arquivo: File) {
    setErro('');
    setAviso('');
    setEnviandoArquivo(true);
    try {
      const dados = new FormData();
      dados.append('file', arquivo);
      const resposta = await fetch(`/api/concessionarias/${id}/modelo/arquivo`, {
        method: 'POST',
        body: dados,
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível enviar o arquivo.');
        return;
      }
      setAviso('Arquivo enviado. O modelo foi desativado -- pré-visualize e reative quando confirmar.');
      await carregar();
    } catch {
      setErro('Falha de conexão ao enviar.');
    } finally {
      setEnviandoArquivo(false);
    }
  }

  async function removerArquivo() {
    if (!window.confirm('Remover o arquivo-modelo atual?')) return;
    setErro('');
    setAviso('');
    try {
      const resposta = await fetch(`/api/concessionarias/${id}/modelo/arquivo`, { method: 'DELETE' });
      if (!resposta.ok) {
        setErro('Não foi possível remover o arquivo.');
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    }
  }

  async function preVisualizar() {
    setErro('');
    setAviso('');
    setPrevendo(true);
    try {
      const resposta = await fetch(`/api/concessionarias/${id}/modelo/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, mapeamentoCampos: mapeamentoAtual(), formatoSaida }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error ?? 'Não foi possível gerar a pré-visualização.');
        return;
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setErro('Falha de conexão ao pré-visualizar.');
    } finally {
      setPrevendo(false);
    }
  }

  async function ativar() {
    setErro('');
    setAviso('');
    setAtivando(true);
    try {
      const resposta = await fetch(`/api/concessionarias/${id}/modelo/ativar`, { method: 'POST' });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível ativar.');
        return;
      }
      setAviso('Modelo ativado. Envios futuros para esta concessionária usam este documento.');
      await carregar();
    } catch {
      setErro('Falha de conexão ao ativar.');
    } finally {
      setAtivando(false);
    }
  }

  async function desativar() {
    setErro('');
    setAviso('');
    setAtivando(true);
    try {
      await fetch(`/api/concessionarias/${id}/modelo/ativar`, { method: 'DELETE' });
      await carregar();
    } catch {
      setErro('Falha de conexão ao desativar.');
    } finally {
      setAtivando(false);
    }
  }

  const preRequisitosFaltando: string[] = [];
  if (tipo === 'GENERICO') preRequisitosFaltando.push('escolha o tipo (DOCX ou XLSX)');
  if (tipo !== 'GENERICO' && !arquivoUrl) preRequisitosFaltando.push('envie o arquivo-modelo');
  if (tipo === 'DOCX' && Object.values(camposDocx).every(v => !v)) preRequisitosFaltando.push('mapeie ao menos um campo');
  if (tipo === 'XLSX' && (Object.values(camposXlsx).every(v => !v) || Object.values(colunasVeiculo).every(v => !v))) {
    preRequisitosFaltando.push('mapeie os campos e a tabela de veículos');
  }

  if (carregando) {
    return <p className="text-paper-dim">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Modelo de documento — {nome}</h1>
        <p className="mt-1 text-sm text-paper-dim">
          Configure o formulário específico desta concessionária. Sem modelo ativo, o envio
          continua usando o ofício genérico da Isenta.
        </p>
      </div>

      {erro && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">{erro}</div>
      )}
      {aviso && (
        <div className="rounded border border-green/40 bg-green/10 p-3 text-sm text-paper">{aviso}</div>
      )}

      {ativo && (
        <div className="rounded border border-green/40 bg-green/10 p-3 text-sm text-paper">
          <Badge variant="success">ATIVO</Badge>{' '}
          Este modelo está ativo — todo envio futuro para esta concessionária usa este documento.
        </div>
      )}

      <Card>
        <CardHeader><h2 className="font-semibold text-paper">1. Tipo de documento</h2></CardHeader>
        <CardBody>
          <select
            value={tipo}
            onChange={e => mudarTipo(e.target.value as Tipo)}
            className="w-full max-w-xs rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
          >
            <option value="GENERICO">Genérico (ofício padrão da Isenta)</option>
            <option value="DOCX">Word (.docx) específico da concessionária</option>
            <option value="XLSX">Excel (.xlsx) específico da concessionária</option>
          </select>
        </CardBody>
      </Card>

      {tipo !== 'GENERICO' && (
        <>
          <Card>
            <CardHeader><h2 className="font-semibold text-paper">2. Arquivo-modelo</h2></CardHeader>
            <CardBody className="space-y-3">
              {arquivoNome ? (
                <div className="flex items-center gap-3 text-sm text-paper">
                  <span>{arquivoNome}</span>
                  <a
                    href={`/api/concessionarias/${id}/modelo/arquivo`}
                    className="text-green hover:underline"
                  >
                    Baixar
                  </a>
                  <button type="button" onClick={removerArquivo} className="text-red-400 hover:underline">
                    Remover
                  </button>
                </div>
              ) : (
                <p className="text-sm text-paper-dim">Nenhum arquivo enviado ainda.</p>
              )}

              <label className="inline-block cursor-pointer rounded border border-white/10 bg-ink-700 px-3 py-2 text-sm text-paper hover:bg-ink-600">
                {enviandoArquivo ? 'Enviando...' : `Enviar .${tipo.toLowerCase()}`}
                <input
                  type="file"
                  accept={tipo === 'DOCX' ? '.docx' : '.xlsx'}
                  className="hidden"
                  disabled={enviandoArquivo}
                  onChange={e => {
                    const arquivo = e.target.files?.[0];
                    if (arquivo) enviarArquivo(arquivo);
                    e.target.value = '';
                  }}
                />
              </label>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-paper">3. Código do formulário (opcional)</h2></CardHeader>
            <CardBody>
              <input
                type="text"
                value={codigoFormulario}
                onChange={e => setCodigoFormulario(e.target.value)}
                placeholder="ex: FOR.CCA.02"
                className="w-full max-w-xs rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-paper">4. Mapeamento de campos</h2></CardHeader>
            <CardBody className="space-y-4">
              {tipo === 'DOCX' && (
                <>
                  <p className="text-xs text-paper-dim">
                    Para cada campo, digite a tag exata usada no seu .docx (ex.: <code>representante</code> para
                    casar com <code>{'{{representante}}'}</code>).
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {CAMPOS_ORGAO_CONHECIDOS.map(campo => (
                      <div key={campo}>
                        <label className="mb-1 block text-xs text-paper-dim">{ROTULO_CAMPO_ORGAO[campo]}</label>
                        <input
                          type="text"
                          value={camposDocx[campo] ?? ''}
                          onChange={e => setCamposDocx({ ...camposDocx, [campo]: e.target.value })}
                          placeholder="tag"
                          className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="rounded border border-white/10 bg-ink-700/40 p-3 text-xs text-paper-dim">
                    Bloco de veículos: o template deve ter <code>{'{{#veiculos}} ... {{/veiculos}}'}</code> com as
                    tags fixas {CAMPOS_VEICULO_CONHECIDOS.map(c => `{{${c}}}`).join(', ')} dentro do bloco — não
                    configurável por campo.
                  </div>
                </>
              )}

              {tipo === 'XLSX' && (
                <>
                  <p className="text-xs text-paper-dim">
                    Para cada campo, digite a referência da célula no seu .xlsx (ex.: <code>B4</code>).
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {CAMPOS_ORGAO_CONHECIDOS.map(campo => (
                      <div key={campo}>
                        <label className="mb-1 block text-xs text-paper-dim">{ROTULO_CAMPO_ORGAO[campo]}</label>
                        <input
                          type="text"
                          value={camposXlsx[campo] ?? ''}
                          onChange={e => setCamposXlsx({ ...camposXlsx, [campo]: e.target.value.toUpperCase() })}
                          placeholder="ex: B4"
                          className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="rounded border border-white/10 bg-ink-700/40 p-3 space-y-3">
                    <div className="max-w-[10rem]">
                      <label className="mb-1 block text-xs text-paper-dim">Linha inicial da tabela de veículos</label>
                      <input
                        type="number"
                        min={1}
                        value={linhaInicial}
                        onChange={e => setLinhaInicial(Number(e.target.value) || 1)}
                        className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {CAMPOS_VEICULO_CONHECIDOS.map(campo => (
                        <div key={campo}>
                          <label className="mb-1 block text-xs text-paper-dim">{ROTULO_CAMPO_VEICULO[campo]}</label>
                          <input
                            type="text"
                            value={colunasVeiculo[campo] ?? ''}
                            onChange={e =>
                              setColunasVeiculo({ ...colunasVeiculo, [campo]: e.target.value.toUpperCase() })
                            }
                            placeholder="coluna, ex: B"
                            className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper placeholder:text-slate"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs text-paper-dim">Formato de saída</label>
                <select
                  value={formatoSaida}
                  onChange={e => setFormatoSaida(e.target.value as 'PDF' | 'MANTER_ORIGINAL')}
                  className="w-full max-w-xs rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
                >
                  <option value="PDF">Converter para PDF antes de anexar</option>
                  <option value="MANTER_ORIGINAL">Anexar o arquivo nativo (.{tipo.toLowerCase()})</option>
                </select>
              </div>

              <Button onClick={salvarConfig} disabled={salvando} size="sm">
                {salvando ? 'Salvando...' : 'Salvar mapeamento'}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-paper">5. Pré-visualizar e ativar</h2></CardHeader>
            <CardBody className="space-y-3">
              <Button variant="secondary" onClick={preVisualizar} disabled={prevendo || !arquivoUrl} size="sm">
                {prevendo ? 'Gerando...' : 'Pré-visualizar com dados de teste'}
              </Button>

              <div>
                {ativo ? (
                  <Button variant="secondary" onClick={desativar} disabled={ativando} size="sm">
                    {ativando ? 'Desativando...' : 'Desativar modelo'}
                  </Button>
                ) : (
                  <>
                    <Button onClick={ativar} disabled={ativando || preRequisitosFaltando.length > 0} size="sm">
                      {ativando ? 'Ativando...' : 'Ativar modelo'}
                    </Button>
                    {preRequisitosFaltando.length > 0 && (
                      <p className="mt-1 text-xs text-paper-dim">
                        Faltando: {preRequisitosFaltando.join('; ')}.
                      </p>
                    )}
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        </>
      )}

      <Link href="/dashboard/admin/concessionarias">
        <Button variant="secondary">Voltar</Button>
      </Link>
    </div>
  );
}
