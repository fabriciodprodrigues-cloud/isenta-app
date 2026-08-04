'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RequestExemptionModal } from '@/components/RequestExemptionModal';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';

interface Registration {
  id: string;
  status: string;
  protocol: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  concessionaire: {
    id: string;
    name: string;
    cnpj: string;
    email: string;
    phone: string;
    website?: string;
    // Nomes vindos do model Concessionaire; estados e uma lista (ex.: "SP,RJ").
    // Ambos sao opcionais no schema.
    cidade: string | null;
    estados: string | null;
  };
  vehicle: {
    plate: string;
  };
}

const statusBadge = {
  rascunho: { label: '📝 Rascunho', color: 'bg-gray-500/20 text-gray-300' },
  enviado: { label: '✉️ Enviado', color: 'bg-blue-500/20 text-blue-300' },
  aguardando_resposta: { label: '⏳ Aguardando', color: 'bg-yellow-500/20 text-yellow-300' },
  aprovado: { label: '✅ Aprovado', color: 'bg-green-500/20 text-green-300' },
  recusado: { label: '❌ Recusado', color: 'bg-red-500/20 text-red-300' },
};

export default function ConcessionariasPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [concessionaires, setConcessionaires] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    // Admin não tem acesso a esta página
    if (session && (session.user as any)?.role === 'admin') {
      router.push('/dashboard');
      return;
    }

    async function loadData() {
      if (!session?.user?.accountId) {
        setLoading(false);
        return;
      }

      try {
        const [regRes, conRes, vehicleRes] = await Promise.all([
          fetch(`/api/registrations?accountId=${session.user.accountId}`),
          fetch('/api/concessionaires'),
          fetch(`/api/vehicles?accountId=${session.user.accountId}`),
        ]);

        if (regRes.ok) {
          const regData = await regRes.json();
          setRegistrations(regData);
        }

        if (conRes.ok) {
          const conData = await conRes.json();
          setConcessionaires(conData);
        }

        if (vehicleRes.ok) {
          const vehicleData = await vehicleRes.json();
          setVehicles(vehicleData);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  const handleSendRegistration = async (registrationId: string) => {
    try {
      setSendingId(registrationId);
      const response = await fetch('/api/registrations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      });

      if (response.ok) {
        // Recarregar dados
        if (session?.user?.accountId) {
          const res = await fetch(`/api/registrations?accountId=${session.user.accountId}`);
          const data = await res.json();
          setRegistrations(data);
        }
      } else {
        alert('Erro ao enviar solicitação');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao enviar solicitação');
    } finally {
      setSendingId(null);
    }
  };

  if (loading) {
    return <div className="text-paper">Carregando...</div>;
  }

  const approvedCount = registrations.filter(r => r.status === 'aprovado').length;
  const pendingCount = registrations.filter(r => r.status === 'aguardando_resposta' || r.status === 'enviado').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-paper">Concessionárias</h1>
        <p className="text-paper-dim text-sm mt-1">
          Gerenciar registrações e aplicações nas concessionárias
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-green-400 mb-2">
              {approvedCount}
            </div>
            <p className="text-paper-dim text-sm">Aprovados</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-yellow-400 mb-2">
              {pendingCount}
            </div>
            <p className="text-paper-dim text-sm">Pendentes</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-accent mb-2">
              {concessionaires.length}
            </div>
            <p className="text-paper-dim text-sm">Concessionárias</p>
          </CardBody>
        </Card>
      </div>

      {/* Botão de Solicitar */}
      <div>
        <Button onClick={() => setShowModal(true)} className="w-full sm:w-auto">
          + Solicitar Isenção
        </Button>
      </div>

      {/* Registrações */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">Registrações de Veículos</h2>
        </CardHeader>
        <CardBody>
          {registrations.length === 0 ? (
            <p className="text-paper-dim text-center py-4">
              Nenhuma registração encontrada
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Veículo</TableCell>
                    <TableCell>Concessionária</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Protocolo</TableCell>
                    <TableCell>Data Aprovação</TableCell>
                    <TableCell>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-mono font-semibold">
                        {reg.vehicle.plate}
                      </TableCell>
                      <TableCell className="text-sm">
                        {reg.concessionaire.name}
                      </TableCell>
                      <TableCell>
                        <div className={statusBadge[reg.status as keyof typeof statusBadge]?.color || 'bg-gray-500/20 text-gray-300'}>
                          {statusBadge[reg.status as keyof typeof statusBadge]?.label}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {reg.protocol || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {reg.approvedAt
                          ? new Date(reg.approvedAt).toLocaleDateString('pt-BR')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {reg.status === 'rascunho' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSendRegistration(reg.id)}
                            disabled={sendingId === reg.id}
                            className="text-xs"
                          >
                            {sendingId === reg.id ? 'Enviando...' : 'Enviar'}
                          </Button>
                        )}
                        {reg.status !== 'rascunho' && <span className="text-paper-dim text-xs">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Lista de Concessionárias */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {concessionaires.length} Concessionária{concessionaires.length !== 1 ? 's' : ''}
          </h2>
        </CardHeader>
        <CardBody>
          {concessionaires.length === 0 ? (
            <p className="text-paper-dim text-center py-4">
              Nenhuma concessionária disponível
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {concessionaires.map((con) => (
                <div
                  key={con.id}
                  className="border border-white/8 rounded-lg p-4 hover:bg-ink-700/50 transition"
                >
                  <h3 className="font-semibold text-paper mb-2">{con.name}</h3>
                  <div className="space-y-1 text-sm text-paper-dim">
                    <p>📍 {[con.cidade, con.estados].filter(Boolean).join(', ') || '—'}</p>
                    <p>📱 {con.phone}</p>
                    <p>📧 {con.email}</p>
                    {con.website && (
                      <p>
                        🌐{' '}
                        <a
                          href={con.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          {con.website}
                        </a>
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full mt-3 text-sm"
                    onClick={() =>
                      window.location.href = `mailto:${con.email}?subject=Isenção de Pedágio`
                    }
                  >
                    Entrar em Contato
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Link de volta */}
      <div className="flex gap-3">
        <Link href="/dashboard/cliente">
          <Button variant="secondary">← Voltar ao Dashboard</Button>
        </Link>
        <Link href="/dashboard/vehicles">
          <Button>Ver Frota →</Button>
        </Link>
      </div>

      {/* Modal */}
      {showModal && (
        <RequestExemptionModal
          vehicles={vehicles}
          concessionaires={concessionaires}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            // Recarregar dados
            if (session?.user?.accountId) {
              fetch(`/api/registrations?accountId=${session.user.accountId}`)
                .then(res => res.json())
                .then(data => setRegistrations(data));
            }
          }}
        />
      )}
    </div>
  );
}
