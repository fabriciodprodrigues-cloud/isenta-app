'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function Cobranca() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Cobrança e Contratos</h1>
        <p className="text-paper-dim text-sm mt-1">
          Gerenciar faturamento, contratos e documentação dos órgãos públicos
        </p>
      </div>

      <Card className="border-2 border-accent">
        <CardBody className="py-16 text-center">
          <div className="text-6xl mb-4">💳</div>
          <h2 className="text-2xl font-bold text-paper mb-2">
            Cobrança e Contratos
          </h2>
          <p className="text-paper-dim mb-6">
            Gerenciar planos de contrato, faturamento, status de pagamento, <br/>
            documentação e cláusulas de autorização dos órgãos.
          </p>
          <div className="inline-flex flex-col gap-2">
            <div className="text-sm text-amber-400 font-medium">
              ⏳ Funcionalidade em desenvolvimento
            </div>
            <p className="text-xs text-paper-dim">
              Disponível após integração com sistema de billing
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">💰 Faturamento por Órgão</h3>
            <p className="text-sm text-paper-dim">
              Plano contratado, faixa de veículos, status de pagamento e emissão de NFS
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">📋 Gestão de Contratos</h3>
            <p className="text-sm text-paper-dim">
              Guardar contrato, aditivos, empenho, ata de registro de preço e autorização
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">← Voltar</Button>
        </Link>
        <Link href="/dashboard/admin/configuracoes">
          <Button variant="secondary">→ Configurações</Button>
        </Link>
      </div>
    </div>
  );
}
