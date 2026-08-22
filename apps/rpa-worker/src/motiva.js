const { get } = require('@vercel/blob');

/**
 * Automação do Portal de Isentos da Motiva (ex-CCR).
 *
 * Cobre oito concessionárias com uma conta só: AutoBAn, MINAS SP, Pantanal,
 * PRVias, RioSP, Sorocabana, ViaCosteira e ViaSul.
 *
 * O fluxo tem quatro passos e uma solicitação por veículo — é essa repetição
 * que justifica o robô. A criação da conta fica de fora: exige código de seis
 * dígitos por e-mail e acontece uma única vez por órgão.
 *
 * Os seletores usam texto visível em vez de classes CSS. Classes de build
 * mudam a cada deploy do portal; rótulos que o usuário lê são bem mais
 * estáveis.
 */

// Os dois domínios servem o mesmo site (confirmado ao vivo), mas o app
// OAuth do login (Azure AD B2C) só tem o redirect_uri do domínio ANTIGO
// registrado — iniciar por motivapagamentos.com.br derruba o login com
// AADB2C90006 (redirect_uri_mismatch), confirmado numa execução real contra
// produção. Cadastrar o novo redirect_uri no Azure é ação de quem administra
// o portal (fora do nosso controle) — até lá, entrar sempre por este domínio.
const URL_PORTAL = 'https://isentos.ccrpagamentos.com.br';

/** Nome da concessionária no nosso banco → rótulo no seletor do portal. */
const NOME_NO_PORTAL = {
  AutoBAn: 'AutoBAn',
  'Motiva Minas SP': 'MINAS SP',
  'Motiva Pantanal': 'Pantanal',
  'Motiva Paraná (ex-PRVias)': 'PRVias',
  'RioSP (CCR RioSP)': 'RioSP',
  'ViaCosteira (CCR ViaCosteira)': 'ViaCosteira',
  ViaSul: 'ViaSul',
};

class ErroDeAutomacao extends Error {
  constructor(mensagem, { precisaDecisao = false } = {}) {
    super(mensagem);
    this.name = 'ErroDeAutomacao';
    this.precisaDecisao = precisaDecisao;
  }
}

function rotuloDaConcessionaria(nome) {
  const rotulo = NOME_NO_PORTAL[nome];
  if (!rotulo) {
    throw new ErroDeAutomacao(
      `Concessionária "${nome}" não tem correspondência conhecida no portal da Motiva.`
    );
  }
  return rotulo;
}

/** Baixa o CRLV do Blob para um arquivo temporário, para o upload do portal. */
async function baixarDocumento(pathname, destino, fs) {
  const resultado = await get(pathname, { access: 'private' });

  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    throw new ErroDeAutomacao(`Documento indisponível no armazenamento: ${pathname}`);
  }

  const buffer = Buffer.from(await new Response(resultado.stream).arrayBuffer());
  await fs.writeFile(destino, buffer);
  return destino;
}

async function entrar(page, credencial, capturar) {
  await page.goto(URL_PORTAL, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /acessar a plataforma|entrar/i }).first().click();

  // O login é Azure AD B2C, em outro domínio.
  await page.waitForURL(/b2clogin\.com/, { timeout: 30_000 });

  // getByLabel sozinho é ambíguo nos dois campos: o de e-mail casa também
  // com o <form> ao redor ("Sign in with your e-mail"), e o de senha casa
  // também com o botão "Mostrar senha" — confirmado numa execução real
  // contra o portal. Interseção com getByRole('textbox') restringe ao
  // campo de fato em ambos os casos.
  await page.getByLabel(/e-?mail/i).and(page.getByRole('textbox')).fill(credencial.usuario);
  await page.getByLabel(/senha/i).and(page.getByRole('textbox')).fill(credencial.senha);
  await page.getByRole('button', { name: /^entrar$/i }).click();

  // Volta para o portal já autenticado. Aceita os dois domínios: confirmado
  // que isentos.ccrpagamentos.com.br (contas antigas, como a da Câmara de
  // Chapadão do Sul) e isentos.motivapagamentos.com.br servem o mesmo site,
  // e o Azure B2C pode devolver pra qualquer um dos dois conforme a conta.
  //
  // Precisa ser função de predicado sobre o HOSTNAME, não regex solta contra
  // a URL inteira: a própria URL de login carrega
  // "...&redirect_uri=https://isentos.ccrpagamentos.com.br/confirm-login" na
  // query string, e uma regex não ancorada casa com esse texto mesmo
  // enquanto a página ainda está no formulário do Azure B2C -- o código
  // seguia adiante achando que o login tinha terminado sem ter terminado.
  // Confirmado numa execução real (log mostrou "pós-login" ainda em
  // b2clogin.com).
  try {
    await page.waitForURL(
      url => /^isentos\.(ccr|motiva)pagamentos\.com\.br$/.test(new URL(url).hostname),
      { timeout: 45_000 }
    );
  } catch {
    throw new ErroDeAutomacao(
      'Login não concluiu. Verifique usuário e senha do portal, ou se a conta pede verificação adicional.'
    );
  }

  console.log('  pós-login em:', page.url());
  if (capturar) await capturar('00-pos-login');
}

/**
 * Preenche uma solicitação. Recebe já resolvido o que veio do banco.
 */
async function criarSolicitacao(page, dados, capturar) {
  const { concessionariaRotulo, veiculo, orgao, temTagNoSistema, arquivoCrlv } = dados;

  // Usa a origem de onde o login deixou a página, não URL_PORTAL fixo: o
  // Azure B2C pode devolver pra ccrpagamentos.com.br OU motivapagamentos.com.br
  // (ver entrar()), e a sessão só vale no domínio onde o cookie foi setado.
  // Forçar o domínio fixo aqui derrubava a sessão silenciosamente — o goto
  // caía na home deslogada e o clique no combobox nunca achava nada,
  // confirmado numa execução real.
  const origemAutenticada = new URL(page.url()).origin;

  console.log('  indo para:', `${origemAutenticada}/solicitacao`);
  await page.goto(`${origemAutenticada}/solicitacao`, { waitUntil: 'domcontentloaded' });
  await capturar('01-inicio');

  // ---- Passo 1: concessionária ----
  await page.getByRole('combobox').first().click();
  await page.getByText(concessionariaRotulo, { exact: true }).click();
  await capturar('02-concessionaria');
  await page.getByRole('button', { name: /continuar/i }).click();

  // ---- Passo 2: tipo de isenção ----
  // O portal separa em Veículo Oficial e Veículo Locado, que é exatamente a
  // distinção que já guardamos em Vehicle.type.
  const rotuloTipo =
    veiculo.type === 'locado' ? /ve[íi]culo locado/i : /ve[íi]culo oficial/i;
  await page.getByText(rotuloTipo).first().click();
  await capturar('03-tipo');
  await page.getByRole('button', { name: /continuar/i }).click();

  // ---- Passo 3: documento ----
  // O card "Documento do Veículo" (com o campo de upload) só aparece depois
  // de uma chamada assíncrona que roda após a navegação — tentar o upload
  // direto encontrava 0 inputs, confirmado numa execução real (o texto da
  // página trazia só os links de ajuda e os botões, sem o card). Espera o
  // card renderizar antes de mexer no input.
  await page.getByText(/documento do ve[íi]culo/i).waitFor({ timeout: 30_000 });
  await page.setInputFiles('input[type="file"]', arquivoCrlv);
  // Espera a confirmação visual de "1 de 1" antes de seguir; sem isso o
  // Continuar pode ser clicado enquanto o upload ainda corre.
  await page.getByText(/\(1 de 1\)/).waitFor({ timeout: 60_000 });
  await capturar('04-documento');
  await page.getByRole('button', { name: /continuar/i }).click();

  // ---- Passo 4: dados ----
  // Dados pessoais já vêm da conta e ficam bloqueados; preenchemos o endereço
  // e o veículo.
  await page.getByLabel(/^cep/i).fill(soDigitos(orgao.cep));
  await page.getByLabel(/^endereço/i).fill(orgao.address ?? '');
  await page.getByLabel(/^número/i).fill(orgao.numero ?? 'S/N');
  if (orgao.complemento) {
    await page.getByLabel(/^complemento/i).fill(orgao.complemento);
  }
  await page.getByLabel(/^bairro/i).fill(orgao.bairro ?? '');
  await page.getByLabel(/^uf/i).selectOption(orgao.state);
  await page.getByLabel(/^cidade/i).fill(orgao.city);

  await page.getByLabel(/placa do ve[íi]culo/i).fill(veiculo.plate);

  // Ao digitar a placa, o portal consulta bases externas e pode encontrar uma
  // TAG Sem Parar. A pergunta só aparece nesse caso.
  await page.waitForTimeout(3_000);

  const blocoTag = page.getByText(/encontramos uma tag/i);
  if (await blocoTag.isVisible().catch(() => false)) {
    const resposta = temTagNoSistema
      ? /SIM, meu ve[íi]culo possui esta tag/i
      : /N[ÃA]O, meu ve[íi]culo não possui esta tag/i;

    await page.getByText(resposta).click();
    await capturar('05-tag');
  }

  await preencherSeVazio(page, /^renavam/i, veiculo.renavam);
  await preencherSeVazio(page, /cor do ve[íi]culo/i, veiculo.cor);
  await preencherSeVazio(page, /marca do ve[íi]culo/i, veiculo.marca);
  await preencherSeVazio(page, /modelo do ve[íi]culo/i, veiculo.modelo);
  await preencherSeVazio(page, /ano fabrica[çc][ãa]o/i, veiculo.anoFabricacao);
  await preencherSeVazio(page, /ano modelo/i, veiculo.anoModelo);

  await capturar('06-dados');
  await page.getByRole('button', { name: /continuar/i }).click();

  // ---- Revisão ----
  await page.getByText(/detalhes da solicita[çc][ãa]o/i).waitFor({ timeout: 30_000 });
  await capturar('07-revisao');

  await page.getByRole('button', { name: /enviar solicita[çc][ãa]o/i }).click();
  await page.waitForTimeout(5_000);
  await capturar('08-enviado');
}

function soDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Só preenche se o campo estiver vazio.
 *
 * O portal preenche vários campos sozinho a partir da consulta pela placa, e
 * sobrescrever o que ele trouxe seria trocar o dado da base oficial pelo
 * nosso, que pode estar desatualizado.
 */
async function preencherSeVazio(page, rotulo, valor) {
  if (valor === null || valor === undefined || valor === '') return;

  const campo = page.getByLabel(rotulo).first();
  const atual = await campo.inputValue().catch(() => '');

  if (!atual) await campo.fill(String(valor));
}

module.exports = {
  URL_PORTAL,
  ErroDeAutomacao,
  rotuloDaConcessionaria,
  baixarDocumento,
  entrar,
  criarSolicitacao,
};
