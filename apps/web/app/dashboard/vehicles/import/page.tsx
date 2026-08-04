'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import Papa from 'papaparse';

interface ImportResult {
  row: number;
  status: 'success' | 'error';
  message: string;
  data?: any;
}

export default function ImportVehiclesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const validateRow = (row: any, rowIndex: number): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!row.placa) errors.push('Placa é obrigatória');
    if (!row.renavam) errors.push('RENAVAM é obrigatório');
    if (!row.marca) errors.push('Marca é obrigatória');
    if (!row.modelo) errors.push('Modelo é obrigatório');
    if (!row.cor) errors.push('Cor é obrigatória');
    if (!row.anoFabricacao) errors.push('Ano de Fabricação é obrigatório');
    if (!row.anoModelo) errors.push('Ano Modelo é obrigatório');

    if (row.anoFabricacao && isNaN(parseInt(row.anoFabricacao))) {
      errors.push('Ano de Fabricação deve ser um número');
    }
    if (row.anoModelo && isNaN(parseInt(row.anoModelo))) {
      errors.push('Ano Modelo deve ser um número');
    }

    return { valid: errors.length === 0, errors };
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setResults([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const importResults: ImportResult[] = [];
        const validRows: any[] = [];

        // Validar todas as linhas primeiro
        results.data.forEach((row: any, index: number) => {
          const { valid, errors } = validateRow(row, index + 1);

          if (!valid) {
            importResults.push({
              row: index + 2, // +2 porque começa em 1 e header conta
              status: 'error',
              message: errors.join('; '),
            });
          } else {
            validRows.push({ ...row, rowIndex: index + 2 });
          }
        });

        // Se houver linhas válidas, importar
        if (validRows.length > 0) {
          try {
            const response = await fetch('/api/vehicles/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vehicles: validRows,
                accountId: session?.user?.accountId || '',
              }),
            });

            if (!response.ok) {
              throw new Error('Erro ao importar veículos');
            }

            const data = await response.json();

            // Adicionar resultados de sucesso
            data.imported.forEach((vehicle: any) => {
              importResults.push({
                row: vehicle.rowIndex,
                status: 'success',
                message: `Veículo ${vehicle.plate} criado com sucesso`,
                data: vehicle,
              });
            });

            // Adicionar erros de importação
            data.errors.forEach((error: any) => {
              importResults.push({
                row: error.rowIndex,
                status: 'error',
                message: error.message,
              });
            });
          } catch (error) {
            validRows.forEach((row) => {
              importResults.push({
                row: row.rowIndex,
                status: 'error',
                message: 'Erro ao salvar no servidor',
              });
            });
          }
        }

        // Ordenar resultados por linha
        importResults.sort((a, b) => a.row - b.row);
        setResults(importResults);
        setShowResults(true);
        setLoading(false);
      },
      error: (error: any) => {
        setResults([
          {
            row: 0,
            status: 'error',
            message: `Erro ao processar arquivo: ${error.message}`,
          },
        ]);
        setShowResults(true);
        setLoading(false);
      },
    });
  };

  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-paper">
          Importar Veículos em Massa
        </h1>
        <p className="mt-1 text-paper-dim">
          Faça upload de uma planilha CSV para cadastrar múltiplos veículos de uma só vez
        </p>
      </div>

      {!showResults ? (
        <Card>
          <CardHeader>
            <h2 className="font-display text-2xl font-bold text-paper">
              Enviar Planilha
            </h2>
            <p className="mt-1 text-paper-dim text-sm">
              Formato: CSV com as seguintes colunas obrigatórias
            </p>
          </CardHeader>

          <CardBody className="space-y-6">
            {/* Instruções */}
            <div className="rounded-lg border border-white/8 bg-ink-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-paper">Formato da Planilha:</h3>
                <a
                  href="/templates/vehicles-template.csv"
                  download="veiculos-template.csv"
                  className="text-sm text-green hover:text-green/80 transition-colors"
                >
                  📥 Download Template
                </a>
              </div>
              <div className="bg-ink-900 rounded p-3 font-mono text-xs text-slate overflow-x-auto">
                <div className="mb-2">Colunas obrigatórias:</div>
                <div>placa,renavam,marca,modelo,cor,anoFabricacao,anoModelo</div>
                <br />
                <div className="mb-2">Exemplo de linha:</div>
                <div>ABC-1234,12345678901,Toyota,Corolla,Branco,2022,2023</div>
              </div>
            </div>

            {/* Campos opcionais */}
            <div className="rounded-lg border border-white/8 bg-ink-700/50 p-4">
              <h3 className="font-semibold text-paper mb-3">Colunas Opcionais:</h3>
              <ul className="text-sm text-slate space-y-1 list-disc list-inside">
                <li>type: &quot;proprio&quot; ou &quot;locado&quot; (padrão: &quot;proprio&quot;)</li>
                <li>category: &quot;oficial&quot;, &quot;ambulancia&quot;, &quot;bombeiro&quot;, &quot;outro&quot; (padrão: &quot;oficial&quot;)</li>
              </ul>
            </div>

            {/* Upload */}
            <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-green/50 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <div className="text-4xl mb-2">📄</div>
                <p className="text-paper font-medium mb-1">
                  {file ? file.name : 'Clique para selecionar arquivo CSV'}
                </p>
                <p className="text-sm text-paper-dim">
                  ou arraste um arquivo aqui
                </p>
              </label>
            </div>
          </CardBody>

          <CardFooter>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg px-4 py-2 text-paper hover:bg-ink-700 transition-colors"
            >
              Cancelar
            </button>
            <Button
              onClick={handleImport}
              loading={loading}
              disabled={!file}
            >
              Importar Veículos
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="font-display text-2xl font-bold text-paper">
              Resultado da Importação
            </h2>
            <p className="mt-1 text-paper-dim text-sm">
              {successCount} sucesso(s) • {errorCount} erro(s)
            </p>
          </CardHeader>

          <CardBody className="space-y-4 max-h-96 overflow-y-auto">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  result.status === 'success'
                    ? 'bg-green-500/10 border-green-500/50'
                    : 'bg-red-500/10 border-red-500/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium ${
                      result.status === 'success' ? 'text-green-300' : 'text-red-300'
                    }`}>
                      Linha {result.row}: {result.status === 'success' ? '✓' : '✗'}
                    </p>
                    <p className="text-sm text-slate mt-1">{result.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardBody>

          <CardFooter>
            <button
              onClick={() => {
                setShowResults(false);
                setFile(null);
                setResults([]);
              }}
              className="rounded-lg px-4 py-2 text-paper hover:bg-ink-700 transition-colors"
            >
              Importar Outro Arquivo
            </button>
            <Button onClick={() => router.push('/dashboard/vehicles')}>
              Ver Veículos
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
