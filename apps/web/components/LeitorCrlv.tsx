'use client';

import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/Button';

/**
 * Envia o CRLV e devolve os campos lidos para preencher o formulário.
 *
 * Preenche — não cadastra. O operador revisa antes de salvar, porque uma placa
 * lida errado sai daqui como ofício assinado pelo órgão para uma
 * concessionária. O componente sinaliza os campos que a leitura marcou como
 * incertos justamente para dirigir a revisão a eles.
 */

const TAMANHO_MAXIMO = 15 * 1024 * 1024;

export interface DadosCrlv {
  placa: string | null;
  renavam: string | null;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  categoria: string | null;
  camposIncertos: string[];
}

export function LeitorCrlv({
  onLido,
}: {
  onLido: (dados: DadosCrlv) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'lendo'>('parado');
  const [erro, setErro] = useState('');

  async function selecionar(arquivo: File) {
    setErro('');

    if (arquivo.size > TAMANHO_MAXIMO) {
      setErro(
        `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB e o limite de leitura é 15 MB. ` +
          'Cadastre manualmente e anexe o documento depois.'
      );
      if (input.current) input.current.value = '';
      return;
    }

    try {
      setEstado('enviando');

      // Direto do navegador para o Blob: pelo nosso servidor o arquivo
      // esbarraria no limite de 4,5 MB de corpo das funções da Vercel.
      const enviado = await upload(`leitura-crlv/${arquivo.name}`, arquivo, {
        access: 'private',
        handleUploadUrl: '/api/vehicles/ler-crlv/upload',
      });

      setEstado('lendo');

      const resposta = await fetch('/api/vehicles/ler-crlv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: enviado.pathname }),
      });

      const corpo = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível ler o documento.');
        return;
      }

      onLido(corpo.dados as DadosCrlv);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no envio.');
    } finally {
      setEstado('parado');
      if (input.current) input.current.value = '';
    }
  }

  const ocupado = estado !== 'parado';

  return (
    <div className="rounded-lg border border-white/8 bg-ink-800 p-4">
      <p className="font-medium text-paper">Preencher pelo CRLV</p>
      <p className="mt-1 text-sm text-paper-dim">
        Envie o CRLV em PDF ou foto e os campos abaixo vêm preenchidos. Confira
        antes de salvar — o pedido de isenção sai em nome do órgão, com os
        dados que estiverem aqui.
      </p>

      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const arquivo = e.target.files?.[0];
          if (arquivo) selecionar(arquivo);
        }}
      />

      <div className="mt-3">
        <Button
          type="button"
          variant="secondary"
          disabled={ocupado}
          onClick={() => input.current?.click()}
        >
          {estado === 'enviando'
            ? 'Enviando...'
            : estado === 'lendo'
              ? 'Lendo o documento...'
              : 'Escolher CRLV'}
        </Button>
        {estado === 'lendo' && (
          <p className="mt-2 text-xs text-slate">
            Leva alguns segundos. Não feche a página.
          </p>
        )}
      </div>

      {erro && (
        <div className="mt-3 rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          {erro}
        </div>
      )}
    </div>
  );
}
