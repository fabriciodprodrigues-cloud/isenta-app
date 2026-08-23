import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processRegistration } from '@/lib/registration-orchestrator';
import { portalDoCanal } from '@/lib/portais';
import { NextResponse } from 'next/server';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

// O envio por e-mail acontece na mesma requisição (ver send/route.ts -- não
// há fila em produção), então esta rota também pode demorar.
export const maxDuration = 60;

/**
 * Acorda o robô de RPA na hora em vez de deixar a solicitação esperando o
 * próximo ciclo de RPA_INTERVALO_MS (5 min por padrão). Só funciona se o
 * worker tiver domínio público configurado no Railway e as duas variáveis
 * abaixo apontarem pra ele -- sem isso, o robô continua pegando a
 * solicitação sozinho no próximo ciclo, só que sem essa aceleração.
 */
async function dispararRpaAgora(): Promise<void> {
  const url = process.env.RPA_WORKER_URL;
  if (!url) return;

  try {
    await fetch(`${url.replace(/\/$/, '')}/disparar`, {
      method: 'POST',
      headers: process.env.RPA_TRIGGER_SECRET
        ? { Authorization: `Bearer ${process.env.RPA_TRIGGER_SECRET}` }
        : {},
      signal: AbortSignal.timeout(5_000),
    });
  } catch (erro) {
    // Best-effort: se o gatilho falhar (worker fora do ar, rede, etc.), a
    // solicitação continua um rascunho válido e o próximo ciclo do robô a
    // pega normalmente. Não vale a pena falhar a criação por causa disso.
    console.error('Falha ao disparar o robô de RPA (rascunho segue pendente):', erro);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { vehicleId, concessionaireId } = body;

    if (!vehicleId || !concessionaireId) {
      return NextResponse.json(
        { error: 'Veículo e concessionária são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o veículo pertence ao usuário
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    // Verificar permissão (operador só pode criar para sua conta)
    if (// @ts-ignore
      (session.user as any)?.role === 'operator' && vehicle.accountId !== (session.user as any)?.accountId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // A concessionária precisa estar habilitada. Esta é a checagem que vale:
    // o filtro do modal é conveniência de interface e não impede uma chamada
    // direta à API.
    const concessionaire = await prisma.concessionaire.findUnique({
      where: { id: concessionaireId },
      select: {
        name: true,
        situacao: true,
        ativoParaCadastro: true,
        tipoCanal: true,
        canalIsentos: true,
      },
    });

    if (!concessionaire) {
      return NextResponse.json(
        { error: 'Concessionária não encontrada' },
        { status: 404 }
      );
    }

    if (concessionaire.situacao !== 'ATIVO' || !concessionaire.ativoParaCadastro) {
      return NextResponse.json(
        {
          error: `${concessionaire.name} não está habilitada para receber solicitações de isenção`,
        },
        { status: 400 }
      );
    }

    // Verificar se já existe registração
    const existingRegistration = await prisma.concesssionaireRegistration.findFirst({
      where: {
        vehicleId,
        concessionaireId,
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'Já existe uma solicitação para este veículo nesta concessionária' },
        { status: 409 }
      );
    }

    // Criar nova solicitação
    const registration = await prisma.concesssionaireRegistration.create({
      data: {
        vehicleId,
        concessionaireId,
        status: 'rascunho',
        sentAt: null,
      },
      include: {
        vehicle: { select: { plate: true } },
        concessionaire: { select: { name: true } },
      },
    });

    // A solicitação não deve ficar esperando uma ação manual pra sair do
    // rascunho -- envia (ou acorda o robô) na hora, conforme o canal da
    // concessionária, em vez de depender de um clique depois ou do próximo
    // ciclo de 5 min do robô.
    let envioMotivo: string | null = null;

    if (concessionaire.tipoCanal === 'EMAIL') {
      try {
        const resultado = await processRegistration(registration.id);
        if (resultado.status !== 'enviado' && 'motivo' in resultado) {
          envioMotivo = resultado.motivo;
        }
      } catch (erro) {
        // Não falha a criação por causa disso: a solicitação já existe como
        // rascunho válido e pode ser reenviada pelo botão depois.
        console.error('Falha ao enviar automaticamente após a criação:', erro);
        envioMotivo = erro instanceof Error ? erro.message : 'Falha ao enviar';
      }
    } else if (portalDoCanal(concessionaire.canalIsentos)?.automatizado) {
      await dispararRpaAgora();
    }

    const registrationAtualizada = await prisma.concesssionaireRegistration.findUnique({
      where: { id: registration.id },
      include: {
        vehicle: { select: { plate: true } },
        concessionaire: { select: { name: true } },
      },
    });

    return NextResponse.json({ ...registrationAtualizada, envioMotivo }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar solicitação:', error);
    return NextResponse.json(
      { error: 'Erro ao criar solicitação' },
      { status: 500 }
    );
  }
}
