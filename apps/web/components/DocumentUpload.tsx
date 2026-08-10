'use client';

import { useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Badge } from '@/components/ui/Badge';

interface Documento {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
}

interface DocumentUploadProps {
  vehicleId: string;
  /** Contrato de locação só é exigido quando o veículo é locado. */
  exigeContrato: boolean;
}

const ROTULOS: Record<string, string> = {
  crlv: 'CRLV',
  contract: 'Contrato de Locação',
  registration: 'Comprovante de Cadastro',
  other: 'Outro',
};

const TAMANHO_MAXIMO = 20 * 1024 * 1024;

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentUpload({ vehicleId, exigeContrato }: DocumentUploadProps) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const tiposExigidos = exigeContrato ? ['crlv', 'contract'] : ['crlv'];

  async function carregar() {
    try {
      const resposta = await fetch(`/api/documents?vehicleId=${vehicleId}`);
      if (resposta.ok) setDocumentos(await resposta.json());
    } catch {
      setErro('Não foi possível carregar os documentos.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  async function enviar(tipo: string, arquivo: File) {
    setErro('');

    if (arquivo.size > TAMANHO_MAXIMO) {
      setErro(
        `Arquivo muito grande: ${formatarTamanho(arquivo.size)}. O limite é 20 MB.`
      );
      const input = inputs.current[tipo];
      if (input) input.value = '';
      return;
    }

    setEnviando(tipo);

    try {
      // Envio direto do navegador para o Blob. Passar o arquivo pela nossa API
      // esbarrava no limite de ~4,5 MB de corpo das funções da Vercel, que
      // devolvia 413 antes de o código rodar.
      await upload(`documentos/${vehicleId}/${tipo}`, arquivo, {
        access: 'private',
        handleUploadUrl: '/api/documents/upload',
        clientPayload: JSON.stringify({
          vehicleId,
          type: tipo,
          fileName: arquivo.name,
        }),
      });

      // O registro é criado pela Vercel ao concluir o envio, o que leva um
      // instante — daí a espera antes de recarregar a lista.
      await new Promise(r => setTimeout(r, 1200));
      await carregar();
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha no envio.';
      setErro(mensagem);
    } finally {
      setEnviando(null);
      const input = inputs.current[tipo];
      if (input) input.value = '';
    }
  }

  async function remover(id: string) {
    setErro('');
    try {
      const resposta = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error ?? 'Falha ao remover o documento.');
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão ao remover.');
    }
  }

  if (carregando) {
    return <p className="text-sm text-slate">Carregando documentos...</p>;
  }

  return (
    <div className="space-y-3">
      {erro && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          {erro}
        </div>
      )}

      {tiposExigidos.map(tipo => {
        const enviado = documentos.find(d => d.type === tipo);

        return (
          <div
            key={tipo}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-ink-700/50 p-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-paper">{ROTULOS[tipo]}</p>
              {enviado ? (
                <p className="truncate text-sm text-slate">
                  {enviado.fileName} · {formatarTamanho(enviado.fileSize)}
                </p>
              ) : (
                <p className="text-sm text-slate">Pendente</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {enviado ? (
                <>
                  <Badge variant="success" size="sm">
                    Enviado
                  </Badge>
                  <a
                    href={`/api/documents/${enviado.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded px-2 py-1 text-sm text-green hover:bg-green/10"
                  >
                    Ver
                  </a>
                  <button
                    type="button"
                    onClick={() => remover(enviado.id)}
                    className="rounded px-2 py-1 text-sm text-slate hover:bg-ink-700"
                  >
                    Remover
                  </button>
                </>
              ) : (
                <>
                  <Badge variant="default" size="sm">
                    Necessário
                  </Badge>
                  <label className="cursor-pointer rounded bg-green px-3 py-1 text-sm font-medium text-ink-900 hover:bg-green/90">
                    {enviando === tipo ? 'Enviando...' : 'Enviar'}
                    <input
                      ref={el => {
                        inputs.current[tipo] = el;
                      }}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="hidden"
                      disabled={enviando !== null}
                      onChange={e => {
                        const arquivo = e.target.files?.[0];
                        if (arquivo) enviar(tipo, arquivo);
                      }}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-slate">
        PDF, JPG ou PNG, até 20 MB. Os documentos ficam acessíveis apenas a
        usuários do órgão e são anexados às solicitações de isenção.
      </p>
    </div>
  );
}
