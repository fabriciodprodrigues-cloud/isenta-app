# Guia de Desenvolvimento

Instruções para desenvolvedores trabalhando no Isenta.

## 🎯 Fases de Desenvolvimento

### Fase 1: Contas + Frota (3–4 semanas)

Entregar um CRUD funcional para que órgãos públicos cadastrem:
- Dados da instituição (CNPJ, responsável, endereço)
- Usuários internos (admin, operador)
- Veículos com upload de documentos

**O que NÃO fazer:**
- RPA/automação de concessionárias
- Integração com Sem Parar
- Cobrança/faturamento

**Checklist de entrega:**
- ✅ Autenticação (admin + operador)
- ✅ CRUD de contas
- ✅ CRUD de usuários da conta
- ✅ CRUD de veículos
- ✅ Upload de CRLV/contrato (R2)
- ✅ Cálculo automático de vencimento
- ✅ UI com identidade visual

### Fase 2: Alertas (1–2 semanas)

Job agendado que:
- Verifica vencimentos diários
- Envia e-mails em 60/30/7 dias
- Marca alertas como enviados

**Checklist:**
- ✅ Queue de e-mail com BullMQ
- ✅ Job agendado (cron)
- ✅ Template de e-mail
- ✅ Integração Resend
- ✅ Log de envios

### Fases 3+

RPA, TAG Sem Parar, cobrança — ver roadmap em `README.md`.

## 🗂️ Convenções de Código

### Estrutura de Pastas

```
apps/web/
├── app/
│   ├── (auth)/          # Páginas públicas (login, etc)
│   ├── (dashboard)/     # Páginas autenticadas
│   │   ├── accounts/
│   │   ├── vehicles/
│   │   └── alerts/
│   ├── api/
│   │   ├── auth/
│   │   ├── accounts/
│   │   └── vehicles/
│   └── layout.tsx
├── components/
│   ├── ui/              # Componentes primitivos (botão, input, etc)
│   ├── forms/           # Formulários
│   ├── layouts/         # Layouts de página
│   └── features/        # Componentes de features específicas
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   └── utils.ts
└── styles/
```

### Nomes de Variáveis

- `snake_case` para variáveis e funções
- `PascalCase` para componentes React e tipos
- Prefixo `use_` para hooks customizados
- Prefixo `on_` para event handlers

### Componentes React

```tsx
// ✅ Bom
interface ProfileCardProps {
  user_id: string;
  show_admin?: boolean;
}

export function ProfileCard({ user_id, show_admin }: ProfileCardProps) {
  return <div>{user_id}</div>;
}

// ❌ Evitar
export default function ProfileCard({ userId, showAdmin }) {
  return <div>{userId}</div>;
}
```

### Server vs Client Components

```tsx
// ✅ Server component (default no Next.js 14)
export async function AccountList() {
  const accounts = await prisma.account.findMany();
  return <div>{/* ... */}</div>;
}

// ✅ Client component (quando precisa de interatividade)
'use client';

export function SearchInput() {
  const [query, setQuery] = useState('');
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

### Formulários

Usar `react-hook-form` + `zod`:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const vehicle_schema = z.object({
  plate: z.string().min(1, 'Placa obrigatória'),
  renavam: z.string().min(11, 'RENAVAM inválido'),
});

export function VehicleForm() {
  const form = useForm({
    resolver: zodResolver(vehicle_schema),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* ... */}
    </form>
  );
}
```

### Chamadas de API

Usar `/api/` routes com validação Zod:

```tsx
// app/api/vehicles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const create_vehicle_schema = z.object({
  plate: z.string(),
  account_id: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = create_vehicle_schema.parse(body);

  const vehicle = await prisma.vehicle.create({ data });
  return NextResponse.json(vehicle);
}
```

## 🎨 Estilo

Tailwind CSS com custom tokens no `tailwind.config.ts`.

### Cores

```tsx
// Usando custom colors
<div className="bg-ink-900 text-paper-dim hover:text-green" />

// Classes responsivas
<div className="text-sm md:text-base lg:text-lg" />
```

### Componentes Recorrentes

Criar no `components/ui/`:

```tsx
// components/ui/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-green text-ink-900 hover:bg-green/90',
    secondary: 'bg-ink-800 text-paper hover:bg-ink-700',
    ghost: 'text-paper hover:bg-ink-800',
  };

  return <button className={styles[variant]} {...props} />;
}
```

## 🔄 Fluxo de Desenvolvimento

1. **Branch:** criar a partir de `main` com prefixo (`feature/`, `fix/`, `docs/`)
2. **Commit:** mensagens descritivas em português
3. **TypeCheck:** `pnpm type-check` antes de pushear
4. **Lint:** `pnpm lint` para verificar estilo
5. **PR:** descrever mudanças e testar em dev

## 🧪 Testing (Futuro)

Por enquanto, testes manuais via painel dev local.

Planejar testes unitários (Jest) e E2E (Playwright) a partir da Fase 2.

## 📚 Referências

- [Especificação Completa](isenta-especificacao-claude-code.md)
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs/)
- [TailwindCSS](https://tailwindcss.com)
- [NextAuth.js](https://next-auth.js.org/)

## 🐛 Troubleshooting

### Erro de Prisma: `Error: P1002`

Database connection falhou. Verificar:

```bash
# 1. PostgreSQL rodando?
psql -U postgres

# 2. DATABASE_URL em .env.local correto?
cat .env.local | grep DATABASE_URL

# 3. Migrations OK?
pnpm exec prisma migrate status
```

### Erro de Auth: `Unauthorized`

Limpar cookies e tentar fazer login novamente:

```bash
# Dev tools → Application → Cookies → limpar localhost
# Ou no navegador: Dev Tools → Ctrl+Shift+Delete → Clear cookies
```

### Erro de Node Modules

Limpar cache e reinstalar:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

Sucesso no desenvolvimento! 🚀
