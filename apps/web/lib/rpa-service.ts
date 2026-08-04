import { chromium, Browser, Page } from 'playwright';
import { prisma } from './prisma';
import fs from 'fs';
import path from 'path';

interface RPAContext {
  registrationId: string;
  vehiclePlate: string;
  concessionaireEmail: string;
  concessionaireName: string;
  accountName: string;
  cnpj: string;
  portalUrl: string;
}

const SCREENSHOT_DIR = path.join(process.cwd(), 'public/rpa-screenshots');

// Criar diretório de screenshots se não existir
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

export async function sendViaPortal(context: RPAContext): Promise<boolean> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log(`[RPA] 🤖 Iniciando automação para ${context.concessionaireName}`);

    // Iniciar browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    page = await browser.newPage();

    // Navegar para portal
    console.log(`[RPA] 🌐 Acessando ${context.portalUrl}`);
    await page.goto(context.portalUrl, { waitUntil: 'networkidle' });

    // Tirar screenshot inicial
    const initialScreenshot = path.join(
      SCREENSHOT_DIR,
      `${context.registrationId}-01-initial.png`
    );
    await page.screenshot({ path: initialScreenshot });
    console.log(`[RPA] 📸 Screenshot inicial: ${initialScreenshot}`);

    // Detectar e executar fluxo específico por concessionaire
    let success = false;

    if (context.concessionaireName.includes('CSG')) {
      success = await handleCSGPortal(page, context);
    } else if (context.concessionaireName.includes('Motiva')) {
      success = await handleMotivaPortal(page, context);
    } else {
      console.warn(`[RPA] ⚠️ Portal não reconhecido: ${context.concessionaireName}`);
      success = false;
    }

    if (success) {
      console.log(`[RPA] ✅ Solicitação ${context.registrationId} enviada via portal`);

      // Atualizar status
      await prisma.concesssionaireRegistration.update({
        where: { id: context.registrationId },
        data: { status: 'enviado', sentAt: new Date() },
      });

      return true;
    } else {
      throw new Error('Falha no processamento do portal');
    }
  } catch (error) {
    console.error(`[RPA] ❌ Erro ao processar portal:`, error);

    // Tirar screenshot de erro
    if (page) {
      const errorScreenshot = path.join(
        SCREENSHOT_DIR,
        `${context.registrationId}-error.png`
      );
      await page.screenshot({ path: errorScreenshot });
      console.log(`[RPA] 📸 Screenshot de erro: ${errorScreenshot}`);
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function handleCSGPortal(page: Page, context: RPAContext): Promise<boolean> {
  try {
    console.log('[RPA] 🔧 Processando portal CSG (Caminhos da Serra Gaúcha)');

    // Procurar botão de cadastro/solicitação
    const submitButton = await page.locator(
      'button:has-text("Solicitar"), button:has-text("Cadastro"), button:has-text("Enviar")'
    ).first();

    if (!(await submitButton.isVisible())) {
      console.warn('[RPA] ⚠️ Botão de submissão não encontrado no CSG');
      return false;
    }

    // Preencher formulário
    const vehiclePlateField = await page.locator(
      'input[placeholder*="placa"], input[name*="plate"], input[id*="plate"]'
    ).first();

    if (await vehiclePlateField.isVisible()) {
      await vehiclePlateField.fill(context.vehiclePlate);
      console.log(`[RPA] 📝 Placa preenchida: ${context.vehiclePlate}`);
    }

    // Tirar screenshot antes de submeter
    const beforeSubmitScreenshot = path.join(
      SCREENSHOT_DIR,
      `${context.registrationId}-02-csg-before-submit.png`
    );
    await page.screenshot({ path: beforeSubmitScreenshot });

    // Submeter
    await submitButton.click();
    await page.waitForTimeout(2000); // Aguardar resposta

    // Tirar screenshot após submit
    const afterSubmitScreenshot = path.join(
      SCREENSHOT_DIR,
      `${context.registrationId}-03-csg-after-submit.png`
    );
    await page.screenshot({ path: afterSubmitScreenshot });

    // Verificar mensagem de sucesso
    const successMessage = await page.locator(
      'text=/sucesso|confirmado|recebido/i'
    ).first();

    const success = await successMessage.isVisible();
    console.log(`[RPA] ${success ? '✅' : '❌'} CSG: ${success ? 'Sucesso' : 'Falha'}`);

    return success;
  } catch (error) {
    console.error('[RPA] Erro ao processar CSG:', error);
    return false;
  }
}

async function handleMotivaPortal(page: Page, context: RPAContext): Promise<boolean> {
  try {
    console.log('[RPA] 🔧 Processando portal Motiva/CCR');

    // Procurar login/autenticação
    const loginField = await page.locator(
      'input[type="email"], input[name*="login"], input[id*="user"]'
    ).first();

    if (await loginField.isVisible()) {
      // Usar CNPJ como login (padrão CCR/Motiva)
      await loginField.fill(context.cnpj);
      console.log(`[RPA] 🔐 Login preenchido com CNPJ`);

      // Procurar e preencher senha (pode ser necessário)
      const passwordField = await page.locator(
        'input[type="password"], input[name*="password"]'
      ).first();

      if (await passwordField.isVisible()) {
        // Usar valor padrão ou variável de ambiente
        const defaultPassword = process.env.MOTIVA_DEFAULT_PASSWORD || '12345678';
        await passwordField.fill(defaultPassword);
        console.log('[RPA] 🔐 Senha preenchida');
      }

      // Submeter login
      const loginButton = await page.locator(
        'button:has-text("Login"), button:has-text("Entrar")'
      ).first();

      if (await loginButton.isVisible()) {
        await loginButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle' });
      }
    }

    // Tirar screenshot após login
    const afterLoginScreenshot = path.join(
      SCREENSHOT_DIR,
      `${context.registrationId}-02-motiva-after-login.png`
    );
    await page.screenshot({ path: afterLoginScreenshot });

    // Procurar área de cadastro/solicitação
    const newRegistrationButton = await page.locator(
      'button:has-text("Novo"), button:has-text("Adicionar"), button:has-text("Registrar")'
    ).first();

    if (await newRegistrationButton.isVisible()) {
      await newRegistrationButton.click();
      await page.waitForTimeout(1000);
    }

    // Preencher dados do veículo
    const vehicleInputs = page.locator('input[type="text"]');
    const count = await vehicleInputs.count();

    if (count > 0) {
      // Preencher primeiro campo com placa
      await vehicleInputs.first().fill(context.vehiclePlate);
      console.log(`[RPA] 📝 Placa preenchida: ${context.vehiclePlate}`);
    }

    // Tirar screenshot antes de submeter
    const beforeSubmitScreenshot = path.join(
      SCREENSHOT_DIR,
      `${context.registrationId}-03-motiva-before-submit.png`
    );
    await page.screenshot({ path: beforeSubmitScreenshot });

    // Submeter formulário
    const submitButton = await page.locator(
      'button:has-text("Enviar"), button:has-text("Solicitar"), button:has-text("Confirmar")'
    ).first();

    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(2000);
    }

    // Tirar screenshot após submit
    const afterSubmitScreenshot = path.join(
      SCREENSHOT_DIR,
      `${context.registrationId}-04-motiva-after-submit.png`
    );
    await page.screenshot({ path: afterSubmitScreenshot });

    // Verificar sucesso
    const successMessage = await page.locator(
      'text=/sucesso|confirmado|aprovado|registrado/i'
    ).first();

    const success = await successMessage.isVisible();
    console.log(`[RPA] ${success ? '✅' : '❌'} Motiva: ${success ? 'Sucesso' : 'Falha'}`);

    return success;
  } catch (error) {
    console.error('[RPA] Erro ao processar Motiva:', error);
    return false;
  }
}

export async function parsePortalResponse(
  registrationId: string,
  portalName: string
): Promise<{
  status: 'approved' | 'rejected' | 'pending';
  message?: string;
}> {
  console.log(`[RPA Parser] 🔍 Analisando resposta de ${portalName}`);

  // Simular análise - em produção, seria verificar o estado do portal via RPA/API
  return {
    status: 'pending',
    message: 'Aguardando atualização do portal',
  };
}
