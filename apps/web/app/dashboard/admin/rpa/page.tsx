'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Screenshot {
  filename: string;
  url: string;
  timestamp: string;
}

export default function RPAExecutionsPage() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrationId, setRegistrationId] = useState('');

  const loadScreenshots = async () => {
    try {
      setLoading(true);
      const url = registrationId
        ? `/api/rpa/screenshots?registrationId=${registrationId}`
        : '/api/rpa/screenshots';

      const response = await fetch(url);
      const data = await response.json();
      setScreenshots(data.screenshots || []);
    } catch (error) {
      console.error('Erro ao carregar screenshots:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScreenshots();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-paper">Execuções RPA</h1>
        <p className="text-paper-dim text-sm mt-1">
          Visualizar logs de automação com Playwright para envios via portal
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardBody className="flex gap-3">
          <input
            type="text"
            placeholder="Filtrar por ID da solicitação..."
            value={registrationId}
            onChange={(e) => setRegistrationId(e.target.value)}
            className="flex-1 px-3 py-2 bg-input border border-border rounded text-paper placeholder:text-paper-dim"
          />
          <Button onClick={loadScreenshots}>Buscar</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setRegistrationId('');
              setScreenshots([]);
            }}
          >
            Limpar
          </Button>
        </CardBody>
      </Card>

      {/* Screenshots */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            Screenshots ({screenshots.length})
          </h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <p className="text-paper-dim text-center py-4">Carregando...</p>
          ) : screenshots.length === 0 ? (
            <p className="text-paper-dim text-center py-4">
              Nenhum screenshot encontrado
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {screenshots.map((screenshot) => (
                <div
                  key={screenshot.filename}
                  className="bg-background p-3 rounded border border-border hover:border-accent transition-colors"
                >
                  <div className="mb-2 h-48 bg-input rounded overflow-hidden">
                    <img
                      src={screenshot.url}
                      alt={screenshot.filename}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() =>
                        window.open(screenshot.url, '_blank')
                      }
                    />
                  </div>
                  <p className="text-xs font-mono text-paper-dim truncate">
                    {screenshot.filename}
                  </p>
                  <p className="text-xs text-paper-dim">
                    {new Date(screenshot.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/dashboard/admin/fila">
          <Button variant="secondary">← Voltar à Fila</Button>
        </Link>
      </div>
    </div>
  );
}
