'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function Relatorios() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Relatórios e Economia</h1>
        <p className="text-paper-dim text-sm mt-1">
          Gerar relatórios de economia, auditoria e eficiência operacional
        </p>
      </div>

      <Card className="border-2 border-accent">
        <CardBody className="py-16 text-center">
          <div className="text-6xl mb-4">📈</div>
          <h2 className="text-2xl font-bold text-paper mb-2">
            Relatórios e Economia
          </h2>
          <p className="text-paper-dim mb-6">
            Visualizar valor de pedágio isento, relatórios de auditoria exportáveis <br/>
            e métricas de eficiência operacional por concessionária.
          </p>
          <div className="inline-flex flex-col gap-2">
            <div className="text-sm text-amber-400 font-medium">
              ⏳ Funcionalidade em desenvolvimento
            </div>
            <p className="text-xs text-paper-dim">
              Disponível após 3 meses de operação para geração de dados
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">💰 Economia Gerada</h3>
            <p className="text-sm text-paper-dim">
              Valor total de pedágio isento por órgão e período. Principal argumento de renovação de contrato
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">📊 Auditoria (PDF/Excel)</h3>
            <p className="text-sm text-paper-dim">
              Relatórios por órgão com histórico de cadastros, protocolos e documentos anexados
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">⚡ Eficiência Operacional</h3>
            <p className="text-sm text-paper-dim">
              Tempo médio de aprovação, taxa de sucesso vs. fallback, concessionárias problemáticas
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">← Voltar</Button>
        </Link>
        <Link href="/dashboard/admin/cobranca">
          <Button variant="secondary">→ Cobrança</Button>
        </Link>
      </div>
    </div>
  );
}
