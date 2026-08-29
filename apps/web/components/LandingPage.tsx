'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarrierLogo } from './BarrierLogo';

const WHATSAPP_URL = 'https://wa.me/5567996607914';

function GridBg() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        backgroundImage:
          'repeating-linear-gradient(90deg, transparent 0 calc(100% / 6 - 1px), rgba(255,255,255,0.02) calc(100% / 6 - 1px) calc(100% / 6))',
      }}
    />
  );
}

function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div
      className={`mb-5 inline-flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.16em] text-green ${center ? 'justify-center' : ''}`}
    >
      <span className="h-px w-[26px] bg-green" />
      {children}
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-[100] border-b border-white/[0.07] bg-ink-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold tracking-[-0.03em]">
            <BarrierLogo size="sm" />
            isenta
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#como" className="text-sm text-paper-dim transition-colors hover:text-paper">Como funciona</a>
            <a href="#beneficios" className="text-sm text-paper-dim transition-colors hover:text-paper">Benefícios</a>
            <a href="#preco" className="text-sm text-paper-dim transition-colors hover:text-paper">Preço</a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-[9px] border border-white/20 px-[18px] py-[9px] text-sm font-semibold transition-all hover:border-green hover:text-green"
            >
              Entrar
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[9px] bg-green px-5 py-[11px] text-sm font-semibold text-ink-900 transition-all hover:-translate-y-px hover:bg-green/90"
            >
              Falar com a gente
            </a>
          </nav>
          <button
            className="text-2xl text-paper md:hidden"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(open => !open)}
          >
            ☰
          </button>
        </div>
        {menuOpen && (
          <div className="flex flex-col gap-1 border-t border-white/[0.07] px-6 py-4 md:hidden">
            <a href="#como" onClick={() => setMenuOpen(false)} className="py-2 text-sm text-paper-dim hover:text-paper">Como funciona</a>
            <a href="#beneficios" onClick={() => setMenuOpen(false)} className="py-2 text-sm text-paper-dim hover:text-paper">Benefícios</a>
            <a href="#preco" onClick={() => setMenuOpen(false)} className="py-2 text-sm text-paper-dim hover:text-paper">Preço</a>
            <Link href="/login" className="py-2 text-sm text-paper-dim hover:text-paper">Entrar</Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-[9px] bg-green px-5 py-[11px] text-sm font-semibold text-ink-900"
            >
              Falar com a gente
            </a>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden py-[90px]">
        <GridBg />
        <div className="relative z-[1] mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-11 px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-[60px]">
          <div>
            <Eyebrow>Isenção de pedágio para frotas públicas</Eyebrow>
            <h1 className="mb-6 font-display text-[38px] font-bold leading-[1.1] tracking-[-0.02em] lg:text-[52px]">
              A isenção da sua frota, <span className="text-green">sempre em dia</span> — sem trabalho.
            </h1>
            <p className="mb-5 font-mono text-sm tracking-[0.02em] text-amber">
              A cancela abre sozinha. A isenção fica em dia.
            </p>
            <p className="mb-9 max-w-[540px] text-[17px] text-paper-dim">
              A Isenta cadastra, renova e monitora a isenção de pedágio dos veículos oficiais do seu
              município em todas as concessionárias do Brasil, com a TAG inclusa. Você não faz nada — a
              gente cuida de tudo, em nome do órgão.
            </p>
            <div className="flex flex-wrap gap-3.5">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-[11px] bg-green px-7 py-[15px] text-[15px] font-semibold text-ink-900 transition-all hover:-translate-y-px hover:bg-green/90"
              >
                Falar com a gente
              </a>
              <a
                href="#como"
                className="inline-flex items-center gap-2 rounded-[11px] border border-white/20 px-7 py-[15px] text-[15px] font-semibold transition-all hover:border-green hover:text-green"
              >
                Como funciona
              </a>
            </div>
          </div>

          <div className="relative flex min-h-[280px] items-center justify-center lg:min-h-[340px]">
            <div className="relative w-full overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-br from-ink-800 to-ink-900 p-11">
              <div className="mb-7 flex items-center gap-2.5 font-mono text-xs text-green">
                <span className="h-2 w-2 rounded-full bg-green shadow-[0_0_0_4px_rgba(33,197,138,0.15)]" />
                ISENÇÃO ATIVA · COBERTURA NACIONAL
              </div>
              {[
                { label: 'Viatura · PMA-2847', status: '✓ isento' },
                { label: 'Ambulância · SMS-1109', status: '✓ isento' },
                { label: 'Frota obras · OBR-0043', status: '✓ isento' },
              ].map(row => (
                <div
                  key={row.label}
                  className="mb-3 flex items-center justify-between rounded-lg border border-white/[0.12] bg-ink-900 px-3.5 py-2.5 font-mono text-[15px]"
                >
                  <span>{row.label}</span>
                  <span className="text-xs text-green">{row.status}</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-white/[0.12] bg-ink-900 px-3.5 py-2.5 font-mono text-[15px] opacity-55">
                <span>Renovação automática</span>
                <span className="text-xs text-green">— em dia</span>
              </div>
              <svg
                className="pointer-events-none absolute -bottom-5 -right-5 opacity-50"
                width="150"
                height="150"
                viewBox="0 0 84 84"
                fill="none"
              >
                <line x1="42" y1="70" x2="70" y2="70" stroke="#7C8FA6" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.4" />
                <g transform="rotate(-35 42 70)">
                  <rect x="40" y="18" width="4" height="52" rx="2" fill="#EDF1F3" opacity="0.9" />
                  <rect x="40" y="18" width="4" height="9" rx="2" fill="#FFB238" />
                  <rect x="40" y="34" width="4" height="9" rx="2" fill="#FFB238" />
                </g>
                <circle cx="42" cy="70" r="4" fill="#21C58A" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="relative py-[60px] lg:py-[88px]">
        <GridBg />
        <div className="relative z-[1] mx-auto max-w-[1180px] px-6">
          <div className="mb-10 max-w-[720px] lg:mb-[52px]">
            <Eyebrow>O problema</Eyebrow>
            <h2 className="mb-4 font-display text-[28px] font-semibold lg:text-[36px]">
              O direito à isenção existe. <span className="text-green">Mantê-lo ativo</span> é o desafio.
            </h2>
            <p className="text-base text-paper-dim">
              Veículos oficiais têm direito à isenção de pedágio — mas ela não é automática. Depende de
              um cadastro que precisa ser renovado em cada concessionária, com prazos que vencem sem
              aviso. Quando vence, o órgão passa a ser cobrado por algo que deveria ser gratuito.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {[
              { ic: '⚠', title: 'Processo fragmentado', body: 'Cada concessionária tem seu portal, seu e-mail e seu prazo. A frota que cruza várias rodovias precisa ser cadastrada em cada uma, separadamente.' },
              { ic: '⏱', title: 'Prazo silencioso', body: 'Quando o cadastro vence, ninguém avisa. A cobrança volta e o veículo isento passa a gerar autuação — muitas vezes sem o órgão perceber.' },
              { ic: '↯', title: 'Dinheiro público perdido', body: 'O município paga por algo que era gratuito e ainda gasta horas de servidor para tentar regularizar depois. Um problema evitável.' },
            ].map(card => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/[0.08] bg-ink-800 p-[30px] transition-all hover:-translate-y-[3px] hover:border-green/30"
              >
                <div className="mb-[18px] flex h-11 w-11 items-center justify-center rounded-[11px] bg-amber-dim text-xl text-amber">
                  {card.ic}
                </div>
                <h3 className="mb-2.5 text-lg font-semibold">{card.title}</h3>
                <p className="text-sm text-paper-dim">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como" className="py-[60px] lg:py-[88px]">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-10 max-w-[720px] lg:mb-[52px]">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mb-4 font-display text-[28px] font-semibold lg:text-[36px]">
              Cadastre a frota uma vez. <span className="text-green">A Isenta cuida do resto.</span>
            </h2>
            <p className="text-base text-paper-dim">
              O servidor faz o mínimo: informa os veículos. Todo o processo com as concessionárias
              acontece de forma automática — e sempre em nome do próprio órgão.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: 1, title: 'Cadastro da frota', body: 'Os veículos oficiais e seus documentos são registrados na plataforma, uma única vez.' },
              { n: 2, title: 'Solicitação automática', body: 'A Isenta gera o ofício no timbre do órgão e protocola a isenção em cada concessionária.' },
              { n: 3, title: 'TAG vinculada', body: 'Cada veículo recebe a TAG Isenta, ligada ao cadastro, para reconhecimento nos pórticos.' },
              { n: 4, title: 'Renovação automática', body: 'A plataforma acompanha cada prazo e renova antes de vencer. A isenção nunca cai.' },
            ].map(step => (
              <div key={step.n} className="rounded-2xl border border-white/[0.08] bg-ink-800 p-7">
                <div className="mb-[18px] flex h-8 w-8 items-center justify-center rounded-[9px] bg-green font-display text-[15px] font-bold text-ink-900">
                  {step.n}
                </div>
                <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
                <p className="text-[13.5px] text-paper-dim">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TAG */}
      <section className="bg-gradient-to-b from-ink-900 via-ink-800 to-ink-900 py-[60px] lg:py-[88px]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-9 px-6 lg:grid-cols-2 lg:gap-14">
          <div>
            <Eyebrow>A TAG Isenta</Eyebrow>
            <h2 className="mb-7 font-display text-[28px] font-semibold lg:text-[34px]">
              Uma TAG vinculada a cada veículo.
            </h2>
            <ul className="list-none">
              {[
                { title: 'Reconhecimento automático', body: 'Identifica o veículo nos pórticos — inclusive no free flow, sem cabine — liberando a passagem isenta na hora.' },
                { title: 'Vinculada ao cadastro de isenção', body: 'O número da TAG entra no cadastro de cada concessionária, fechando o ciclo entre identificação e isenção.' },
                { title: 'Já inclusa no pacote', body: 'Sem contrato de TAG à parte, sem mensalidade separada. Uma solução única para o município.' },
                { title: 'Cobertura nacional', body: 'Reconhecida nas rodovias pedagiadas do país todo.' },
              ].map(item => (
                <li key={item.title} className="mb-[22px] flex items-start gap-3.5">
                  <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-green-dim text-sm font-bold text-green">
                    ✓
                  </span>
                  <div>
                    <b className="mb-0.5 block font-display text-base font-semibold">{item.title}</b>
                    <span className="text-sm text-paper-dim">{item.body}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-gradient-to-br from-ink-800 to-ink-900 p-9 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
            <div className="mb-1.5 flex items-center gap-2.5">
              <BarrierLogo size="sm" />
              <span className="font-display text-[26px] font-bold">isenta</span>
            </div>
            <div className="mb-[26px] text-xs text-slate">Uma solução ConectCar</div>
            <div className="flex items-end justify-between">
              <div className="font-mono text-[13px] tracking-[2px] text-slate">0000&nbsp;0000&nbsp;00</div>
              <div className="grid h-[66px] w-[66px] grid-cols-5 grid-rows-5 gap-0.5 rounded-lg bg-paper p-[7px]">
                {[1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1].map((on, i) => (
                  <i key={i} className={`rounded-[1px] ${on ? 'bg-ink-900' : 'bg-paper'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section id="beneficios" className="relative py-[60px] lg:py-[88px]">
        <GridBg />
        <div className="relative z-[1] mx-auto max-w-[1180px] px-6">
          <div className="mb-10 max-w-[720px] lg:mb-[52px]">
            <Eyebrow>Benefícios</Eyebrow>
            <h2 className="font-display text-[28px] font-semibold lg:text-[36px]">
              O que o município ganha <span className="text-green">com a Isenta.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {[
              { title: 'Fim das cobranças indevidas', body: 'A frota nunca mais é cobrada por pedágio que já deveria ser gratuito. Economia direta de recursos públicos.' },
              { title: 'Zero trabalho para o servidor', body: 'Nada de entrar em portal de concessionária ou controlar prazos em planilha. A Isenta faz tudo, em nome do órgão.' },
              { title: 'Transparência e prestação de contas', body: 'Relatórios de economia e histórico de cada cadastro e protocolo, prontos para auditoria.' },
              { title: 'Cobertura nacional', body: 'Concessionárias federais, estaduais e municipais. Onde a frota rodar, a isenção acompanha.' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-4.5 rounded-2xl border border-white/[0.08] bg-ink-800 p-[30px]">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-green-dim text-[19px] text-green">
                  ✓
                </div>
                <div>
                  <h3 className="mb-[7px] text-[17px] font-semibold">{item.title}</h3>
                  <p className="text-sm text-paper-dim">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPRA */}
      <section className="py-[60px] lg:py-[88px]">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-ink-800 p-9 lg:p-[52px]">
            <GridBg />
            <div className="relative z-[1] max-w-[620px]">
              <Eyebrow>Aquisição descomplicada</Eyebrow>
              <h2 className="mb-4 font-display text-[26px] font-semibold lg:text-[30px]">
                A Isenta entrega o processo de compra pronto.
              </h2>
              <p className="mb-2 text-base text-paper-dim">
                Sabemos que contratar no setor público tem suas regras. Por isso, não deixamos o
                município sozinho na burocracia: orientamos e preparamos a documentação para a
                modalidade de contratação mais adequada ao seu caso, e acompanhamos cada etapa até a
                assinatura.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {['Dispensa por valor', 'Modalidade adequada', 'Documentação preparada', 'Suporte do início ao fim'].map(tag => (
                  <span key={tag} className="rounded-full bg-green-dim px-3.5 py-1.5 font-mono text-xs text-green">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRECO */}
      <section id="preco" className="relative py-[60px] lg:py-[88px]">
        <GridBg />
        <div className="relative z-[1] mx-auto max-w-[1180px] px-6">
          <div className="mx-auto mb-10 max-w-[720px] text-center lg:mb-[52px]">
            <Eyebrow center>Investimento</Eyebrow>
            <h2 className="font-display text-[28px] font-semibold lg:text-[36px]">
              Um valor único, <span className="text-green">tudo incluso.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-[20px] border border-green/35 bg-gradient-to-br from-ink-800 to-ink-900 p-9 lg:p-11">
              <div className="absolute inset-x-0 top-0 h-1 bg-green" />
              <div className="mb-5 font-mono text-xs uppercase tracking-[0.08em] text-slate">
                Assinatura por veículo
              </div>
              <div className="mb-2 font-display text-[46px] font-bold leading-none tracking-[-0.03em] lg:text-[58px]">
                <span className="align-super text-2xl text-paper-dim lg:text-[26px]">R$</span> 99,90{' '}
                <span className="text-base font-normal text-slate">/ mês</span>
              </div>
              <div className="mt-4 text-sm text-paper-dim">
                Plano anual. Inclui o cadastro e a renovação da isenção em todas as concessionárias, a
                TAG vinculada ao veículo, o monitoramento de prazos e os relatórios — sem custos ocultos
                e sem contrato de TAG à parte.
              </div>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-[11px] bg-green px-7 py-[15px] text-[15px] font-semibold text-ink-900 transition-all hover:-translate-y-px hover:bg-green/90"
              >
                Solicitar proposta
              </a>
            </div>
            <div className="rounded-[20px] border border-white/[0.08] bg-ink-800 p-9 lg:p-10">
              <div className="mb-[22px] font-mono text-xs uppercase tracking-[0.08em] text-slate">
                O que está incluso
              </div>
              <ul className="list-none">
                {[
                  'Cadastro e renovação em todas as concessionárias',
                  'TAG Isenta vinculada a cada veículo',
                  'Monitoramento e alertas de vencimento',
                  'Relatórios de economia e auditoria',
                  'Processo de compra estruturado pela Isenta',
                  'Suporte durante todo o contrato',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 border-b border-white/[0.04] py-[9px] text-[14.5px] text-paper-dim last:border-none">
                    <span className="font-bold text-green">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative py-[70px] text-center lg:py-[100px]">
        <GridBg />
        <div className="relative z-[1] mx-auto max-w-[1180px] px-6">
          <h2 className="mb-[18px] font-display text-[30px] font-bold lg:text-[40px]">
            Sua frota tem direito.
            <br />
            <span className="text-green">Deixe a Isenta garantir.</span>
          </h2>
          <p className="mb-9 text-[17px] text-paper-dim">
            Vamos conversar sobre como proteger a frota do seu município — do primeiro cadastro à
            contratação.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[11px] bg-green px-7 py-[15px] text-[15px] font-semibold text-ink-900 transition-all hover:-translate-y-px hover:bg-green/90"
          >
            Falar com a gente
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.08] py-14 pb-10">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-9 flex flex-wrap justify-between gap-10">
            <div className="max-w-[320px]">
              <Link href="/" className="mb-3.5 flex items-center gap-2.5 font-display text-xl font-bold">
                <BarrierLogo size="sm" />
                isenta
              </Link>
              <p className="font-mono text-xs italic text-slate">
                A cancela abre sozinha. A isenção fica em dia.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.1em] text-slate">Navegação</h4>
              <a href="#como" className="mb-2.5 block text-sm text-paper-dim hover:text-green">Como funciona</a>
              <a href="#beneficios" className="mb-2.5 block text-sm text-paper-dim hover:text-green">Benefícios</a>
              <a href="#preco" className="mb-2.5 block text-sm text-paper-dim hover:text-green">Preço</a>
            </div>
            <div>
              <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.1em] text-slate">Contato</h4>
              <a href="mailto:contato@plataformaisenta.com" className="mb-2.5 block text-sm text-paper-dim hover:text-green">
                contato@plataformaisenta.com
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="mb-2.5 block text-sm text-paper-dim hover:text-green">
                (67) 99660-7914
              </a>
              <a href="https://www.plataformaisenta.com" className="mb-2.5 block text-sm text-paper-dim hover:text-green">
                www.plataformaisenta.com
              </a>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-slate">
            <span>© 2026 Isenta · Agência Infinity Serviços de Eventos e Publicidades Ltda</span>
            <span>Gestão de isenção de pedágio para frotas públicas</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
