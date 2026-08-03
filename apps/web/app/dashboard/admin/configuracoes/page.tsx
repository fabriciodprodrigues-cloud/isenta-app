'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function Configuracoes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Configuração e Monitoramento Técnico</h1>
        <p className="text-paper-dim text-sm mt-1">
          Saúde dos sistemas, configurações de integração e parâmetros de alerta
        </p>
      </div>

      <Card className="border-2 border-accent">
        <CardBody className="py-16 text-center">
          <div className="text-6xl mb-4">⚙️</div>
          <h2 className="text-2xl font-bold text-paper mb-2">
            Configuração e Monitoramento
          </h2>
          <p className="text-paper-dim mb-6">
            Monitorar saúde dos robôs RPA, entregabilidade de e-mail, <br/>
            configurar integrações e parâmetros de alerta do sistema.
          </p>
          <div className="inline-flex flex-col gap-2">
            <div className="text-sm text-amber-400 font-medium">
              ⏳ Funcionalidade em desenvolvimento
            </div>
            <p className="text-xs text-paper-dim">
              Disponível após integração de RPA estar completa
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">🤖 Saúde dos RPA</h3>
            <p className="text-sm text-paper-dim">
              Quais robôs funcionam, falharam, screenshots de erro, última execução bem-sucedida
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">📧 Entregabilidade</h3>
            <p className="text-sm text-paper-dim">
              Log de bounces, spam, sem resposta. Alerta se canal de e-mail parou de responder
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">⚙️ Configurações Gerais</h3>
            <p className="text-sm text-paper-dim">
              Domínio de envio (SPF/DKIM/DMARC), integrações, parâmetros de alerta
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Mock Configuration Section */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-paper">Integrações</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-ink-700 rounded">
              <span className="text-sm text-paper">Sem Parar (TAGs)</span>
              <span className="text-xs text-amber-400">Aguardando</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-ink-700 rounded">
              <span className="text-sm text-paper">Email SMTP</span>
              <span className="text-xs text-green-400">✓ Ativo</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-ink-700 rounded">
              <span className="text-sm text-paper">Redis (Fila)</span>
              <span className="text-xs text-green-400">✓ Ativo</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-paper">Parâmetros de Alerta</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-ink-700 rounded">
              <span className="text-sm text-paper">Dias antes vencimento</span>
              <input type="text" value="7" className="w-16 px-2 py-1 bg-input border border-border rounded text-right text-sm" />
            </div>
            <div className="flex items-center justify-between p-3 bg-ink-700 rounded">
              <span className="text-sm text-paper">Estoque mínimo TAGs</span>
              <input type="text" value="50" className="w-16 px-2 py-1 bg-input border border-border rounded text-right text-sm" />
            </div>
            <div className="flex items-center justify-between pt-3">
              <Button size="sm">Salvar</Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">← Voltar ao Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
