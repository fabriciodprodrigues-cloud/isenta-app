'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { format_date } from '@/lib/utils';

interface Document {
  id: string;
  vehicleId: string;
  type: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  vehicle: {
    plate: string;
  };
}

const documentTypes = {
  crlv: '🚗 CRLV',
  contract: '📋 Contrato',
  registration: '✅ Registro',
  other: '📄 Outro',
};

export default function DocumentosPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Admin não tem acesso a esta página
    if (session && (session.user as any)?.role === 'admin') {
      router.push('/dashboard');
      return;
    }

    async function loadDocuments() {
      if (!session?.user?.accountId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/vehicles?accountId=${session.user.accountId}&includeDocuments=true`);
        if (response.ok) {
          const vehicles = await response.json();
          const allDocs = vehicles.flatMap((v: any) =>
            (v.documents || []).map((d: any) => ({ ...d, vehicle: { plate: v.plate } }))
          );
          setDocuments(allDocs);
        }
      } catch (error) {
        console.error('Erro ao carregar documentos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDocuments();
  }, [session]);

  if (loading) {
    return <div className="text-paper">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-paper">Documentos</h1>
        <p className="text-paper-dim text-sm mt-1">
          Gerenciar CRLV, contratos e registros de veículos
        </p>
      </div>

      {/* Instruções */}
      <Card>
        <CardBody className="bg-ink-700/50 p-4">
          <h3 className="font-semibold text-paper mb-2">📝 Como fazer upload</h3>
          <ol className="text-paper-dim text-sm space-y-1">
            <li>1. Vá para a página de detalhes do veículo</li>
            <li>2. Clique em &quot;Upload de Documentos&quot;</li>
            <li>3. Selecione o tipo (CRLV, Contrato, etc)</li>
            <li>4. Faça upload do arquivo PDF ou imagem</li>
            <li>5. Os documentos serão armazenados com segurança</li>
          </ol>
        </CardBody>
      </Card>

      {/* Documentos */}
      {documents.length === 0 ? (
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-paper-dim">Nenhum documento enviado ainda</p>
            <Link href="/dashboard/vehicles">
              <Button className="mt-4">Ir para Frota</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-paper">
              {documents.length} documento{documents.length !== 1 ? 's' : ''}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Veículo</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Arquivo</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono font-semibold">
                        {doc.vehicle.plate}
                      </TableCell>
                      <TableCell>
                        {documentTypes[doc.type as keyof typeof documentTypes] || doc.type}
                      </TableCell>
                      <TableCell className="text-sm text-paper-dim">
                        {doc.fileName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format_date(new Date(doc.uploadedAt))}
                      </TableCell>
                      <TableCell>
                        {/*
                          Vai pela rota autenticada, nao pelo campo url. Com a
                          store privada, url guarda o pathname do blob — um
                          link direto para ele nao resolve, e ainda expunha o
                          caminho interno do arquivo.
                        */}
                        <a
                          href={`/api/documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          Visualizar
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Link de volta */}
      <div className="flex gap-3">
        <Link href="/dashboard/cliente">
          <Button variant="secondary">← Voltar ao Dashboard</Button>
        </Link>
        <Link href="/dashboard/vehicles">
          <Button>Ver Frota →</Button>
        </Link>
      </div>
    </div>
  );
}
