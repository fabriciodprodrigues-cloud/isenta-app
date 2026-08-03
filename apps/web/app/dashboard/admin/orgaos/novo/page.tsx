'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function NovoOrgao() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    razaoSocial: '',
    cnpj: '',
    responsibleName: '',
    responsibleEmail: '',
    responsiblePhone: '',
    address: '',
    city: '',
    state: 'SP',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/dashboard/admin/orgaos');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao criar órgão');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao criar órgão');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Novo Órgão</h1>
        <p className="text-paper-dim text-sm mt-1">
          Cadastrar um novo órgão público no sistema
        </p>
      </div>

      <Card>
        <CardHeader>Informações do Órgão</CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-paper mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Prefeitura de São Paulo"
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-paper mb-1">Razão Social</label>
                <input
                  type="text"
                  value={formData.razaoSocial}
                  onChange={e => setFormData({ ...formData, razaoSocial: e.target.value })}
                  placeholder="ex: Município de São Paulo"
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-paper mb-1">CNPJ</label>
                <input
                  type="text"
                  value={formData.cnpj}
                  onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-paper mb-1">Cidade</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  placeholder="ex: São Paulo"
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-paper mb-1">Estado</label>
                <select
                  value={formData.state}
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                  required
                >
                  <option value="SP">São Paulo</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="BA">Bahia</option>
                  <option value="PR">Paraná</option>
                  <option value="RS">Rio Grande do Sul</option>
                  <option value="PE">Pernambuco</option>
                  <option value="CE">Ceará</option>
                  <option value="PA">Pará</option>
                  <option value="SC">Santa Catarina</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-paper mb-1">Endereço</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="ex: Avenida Paulista, 1000"
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                  required
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h3 className="font-semibold text-paper mb-4">Responsável</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-paper mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.responsibleName}
                    onChange={e => setFormData({ ...formData, responsibleName: e.target.value })}
                    placeholder="ex: João Silva"
                    className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-paper mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.responsibleEmail}
                    onChange={e => setFormData({ ...formData, responsibleEmail: e.target.value })}
                    placeholder="ex: joao@example.com"
                    className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-paper mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={formData.responsiblePhone}
                    onChange={e => setFormData({ ...formData, responsiblePhone: e.target.value })}
                    placeholder="ex: (11) 98765-4321"
                    className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Criando...' : 'Criar Órgão'}
              </Button>
              <Link href="/dashboard/admin/orgaos">
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
