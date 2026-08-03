'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function GestáoConcessionarias() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Gestão de Concessionárias</h1>
        <p className="text-paper-dim text-sm mt-1">
          Configurar canais, campos obrigatórios e status de ativação para cadastros
        </p>
      </div>

      <Card className="border-2 border-accent">
        <CardBody className="py-16 text-center">
          <div className="text-6xl mb-4">🛣️</div>
          <h2 className="text-2xl font-bold text-paper mb-2">
            Gestão de Concessionárias
          </h2>
          <p className="text-paper-dim mb-6">
            Ativar concessionárias após validação de primeiro cadastro, configurar templates, <br/>
            campos obrigatórios e monitorar editais de novas concessões.
          </p>
          <div className="inline-flex flex-col gap-2">
            <div className="text-sm text-amber-400 font-medium">
              ⏳ Funcionalidade em desenvolvimento
            </div>
            <p className="text-xs text-paper-dim">
              Disponível após integração de portais estar completa
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">📋 Tabela Editável</h3>
            <p className="text-sm text-paper-dim">
              Lista completa de concessionárias com opção de editar canal de isentos e campos obrigatórios
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">🟢 Ativação Controlada</h3>
            <p className="text-sm text-paper-dim">
              Toggle ativoParaCadastro só é ligado após validação de cadastro real de ponta a ponta
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">📰 Monitor de Editais</h3>
            <p className="text-sm text-paper-dim">
              Sinalizar novas concessões detectadas em secretarias estaduais, ANTT e Diários Oficiais
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-8">
            <h3 className="font-semibold text-paper mb-2">🤖 Templates por Concessionária</h3>
            <p className="text-sm text-paper-dim">
              Configurar templates de e-mail e mapa de campos RPA para cada portal
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">← Voltar</Button>
        </Link>
        <Link href="/dashboard/admin/tags">
          <Button variant="secondary">→ Gestão de TAGs</Button>
        </Link>
      </div>
    </div>
  );
}
