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

interface Tag {
  id: string;
  serialNumber: string;
  status: string;
  vehicleId: string | null;
  vehicle?: { plate: string } | null;
  assignedAt: string | null;
  expiresAt: string | null;
}

const statusBadge: Record<
  string,
  { label: string; variant: 'success' | 'info' | 'error' | 'default' }
> = {
  available: { label: '✓ Disponível', variant: 'success' },
  assigned: { label: '→ Atribuída', variant: 'info' },
  expired: { label: '✗ Expirada', variant: 'error' },
  inactive: { label: '○ Inativa', variant: 'default' },
};

export default function TagsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Admin não tem acesso a esta página
    if (session && (session.user as any)?.role === 'admin') {
      router.push('/dashboard');
      return;
    }

    async function loadTags() {
      if (!session?.user?.accountId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/tags?accountId=${session.user.accountId}`);
        if (response.ok) {
          const data = await response.json();
          setTags(data);
        }
      } catch (error) {
        console.error('Erro ao carregar TAGs:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTags();
  }, [session]);

  if (loading) {
    return <div className="text-paper">Carregando...</div>;
  }

  const availableTags = tags.filter(t => t.status === 'available');
  const assignedTags = tags.filter(t => t.status === 'assigned');
  const expiredTags = tags.filter(t => t.status === 'expired');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-paper">TAGs de Isenção</h1>
        <p className="text-paper-dim text-sm mt-1">
          Gerenciar TAGs RFID para uso nas cancelas
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-green-400 mb-2">
              {availableTags.length}
            </div>
            <p className="text-paper-dim text-sm">Disponíveis</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-blue-400 mb-2">
              {assignedTags.length}
            </div>
            <p className="text-paper-dim text-sm">Atribuídas</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-red-400 mb-2">
              {expiredTags.length}
            </div>
            <p className="text-paper-dim text-sm">Expiradas</p>
          </CardBody>
        </Card>
      </div>

      {/* Informações */}
      <Card>
        <CardBody className="bg-ink-700/50 p-4">
          <h3 className="font-semibold text-paper mb-2">💡 O que é TAG?</h3>
          <p className="text-paper-dim text-sm mb-3">
            TAG é um identificador RFID que permite passagens gratuitas nas cancelas de pedágio.
            Cada TAG é vinculada a um veículo específico e pode ter validade.
          </p>
          <h3 className="font-semibold text-paper mb-2">🔄 Como usar</h3>
          <ol className="text-paper-dim text-sm space-y-1">
            <li>1. Solicite TAGs disponíveis na concessionária</li>
            <li>2. Quando chegar, instale no veículo (parabrisas ou chassis)</li>
            <li>3. Verifique a validade periodicamente</li>
            <li>4. Solicite renovação antes de expirar</li>
          </ol>
        </CardBody>
      </Card>

      {/* Tabela de TAGs */}
      {tags.length === 0 ? (
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-paper-dim">Nenhuma TAG disponível</p>
            <Link href="/dashboard/concessionarias">
              <Button className="mt-4">Contatar Concessionária</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-paper">
              {tags.length} TAG{tags.length !== 1 ? 's' : ''}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Serial</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Veículo</TableCell>
                    <TableCell>Validade</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell className="font-mono font-semibold text-accent">
                        {tag.serialNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadge[tag.status]?.variant ?? 'default'}>
                          {statusBadge[tag.status]?.label ?? tag.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tag.vehicle ? (
                          <span className="font-mono">{tag.vehicle.plate}</span>
                        ) : (
                          <span className="text-paper-dim">Sem atribuição</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tag.expiresAt ? format_date(new Date(tag.expiresAt)) : '—'}
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
        <Link href="/dashboard/concessionarias">
          <Button>Ver Concessionárias →</Button>
        </Link>
      </div>
    </div>
  );
}
