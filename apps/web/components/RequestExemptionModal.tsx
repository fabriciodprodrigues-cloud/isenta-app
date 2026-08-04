'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

interface Vehicle {
  id: string;
  plate: string;
}

interface Concessionaire {
  id: string;
  name: string;
  estados?: string; // JSON array string like '["SP","RJ"]'
  esfera?: string;
  regulador?: string;
  situacao?: string;
  ativoParaCadastro?: boolean;
  canalIsentos?: string | null;
  tipoCanal?: string | null;
}

const CANAL_LABELS: Record<string, string> = {
  EMAIL: 'e-mail',
  PORTAL_WEB: 'portal web',
  PORTAL_MAIS_ATENDIMENTO: 'portal +Atendimento',
  MANUAL: 'manual',
};

interface RequestExemptionModalProps {
  vehicles: Vehicle[];
  concessionaires: Concessionaire[];
  onClose: () => void;
  onSuccess: () => void;
}

export function RequestExemptionModal({
  vehicles,
  concessionaires,
  onClose,
  onSuccess,
}: RequestExemptionModalProps) {
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedConcessionaires, setSelectedConcessionaires] = useState<string[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>(vehicles.map(v => v.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Agrupar concessionárias por estado. Só entram as habilitadas — a API de
  // criação rejeita as demais, então lista-las aqui só geraria falha.
  const stateGroups = useMemo(() => {
    const groups: Record<string, Concessionaire[]> = {};
    concessionaires
      .filter(c => c.ativoParaCadastro !== false)
      .forEach(c => {
        try {
          // Parse estados array from JSON string
          const estados = c.estados ? JSON.parse(c.estados) : [];
          if (Array.isArray(estados)) {
            estados.forEach(estado => {
              if (!groups[estado]) {
                groups[estado] = [];
              }
              groups[estado].push(c);
            });
          }
        } catch (e) {
          console.error(`Error parsing estados for concessionaire ${c.id}:`, e);
        }
      });
    return groups;
  }, [concessionaires]);

  const states = Object.keys(stateGroups).sort();
  const concessionairesInState = selectedState ? stateGroups[selectedState] : [];

  const toggleConcessionaire = (id: string) => {
    setSelectedConcessionaires(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllInState = () => {
    const allInState = concessionairesInState.map(c => c.id);
    setSelectedConcessionaires(allInState);
  };

  const toggleVehicle = (id: string) => {
    setSelectedVehicles(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllVehicles = () => {
    setSelectedVehicles(vehicles.map(v => v.id));
  };

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setSelectedConcessionaires([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedVehicles.length === 0 || selectedConcessionaires.length === 0) {
      setError('Selecione pelo menos um veículo e uma concessionária');
      return;
    }

    setLoading(true);

    try {
      let successCount = 0;
      const motivos = new Set<string>();

      for (const vehicleId of selectedVehicles) {
        for (const concessionaireId of selectedConcessionaires) {
          try {
            const response = await fetch('/api/registrations/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vehicleId,
                concessionaireId,
              }),
            });

            if (response.ok) {
              successCount++;
            } else {
              // Sem isto o usuário via apenas "N falharam" e não tinha como
              // saber se foi duplicidade, concessionária inapta ou permissão.
              const corpo = await response.json().catch(() => null);
              motivos.add(corpo?.error ?? `Erro ${response.status}`);
            }
          } catch (err) {
            motivos.add('Falha de conexão');
          }
        }
      }

      if (motivos.size > 0) {
        const lista = Array.from(motivos).join('; ');
        setError(
          successCount > 0
            ? `${successCount} solicitações criadas. Não foi possível criar as demais: ${lista}`
            : `Nenhuma solicitação criada: ${lista}`
        );
      } else {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError('Erro ao criar solicitações');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <h2 className="text-xl font-bold text-paper">
            Solicitar Isenção para Frota
          </h2>
          <p className="text-paper-dim text-sm mt-1">
            Selecione o estado, concessionárias e veículos para solicitar isenção
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Seleção de Estado */}
          <div>
            <label className="block text-sm font-medium text-paper mb-2">
              📍 Estado
            </label>
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper focus:border-green focus:outline-none"
            >
              <option value="">-- Selecione um estado --</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          {/* Concessionárias por Estado */}
          {selectedState && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-paper">
                  🚗 Concessionárias em {selectedState} ({selectedConcessionaires.length})
                </label>
                {concessionairesInState.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllInState}
                    className="text-xs text-accent hover:text-green transition"
                  >
                    Selecionar todas
                  </button>
                )}
              </div>
              <div className="space-y-2 bg-ink-700/30 p-3 rounded border border-white/10">
                {concessionairesInState.length === 0 ? (
                  <p className="text-paper-dim text-sm text-center py-4">
                    Nenhuma concessionária neste estado
                  </p>
                ) : (
                  concessionairesInState.map((c) => (
                    <label key={c.id} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedConcessionaires.includes(c.id)}
                        onChange={() => toggleConcessionaire(c.id)}
                        className="w-4 h-4 rounded accent-green mt-0.5"
                      />
                      <span className="text-paper text-sm">
                        {c.name}
                        {c.canalIsentos ? (
                          <span className="block text-xs text-green">
                            canal por {CANAL_LABELS[c.tipoCanal ?? ''] ?? 'canal direto'}
                          </span>
                        ) : (
                          <span className="block text-xs text-slate">
                            sem canal cadastrado — exigirá tratativa manual
                          </span>
                        )}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Veículos */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-paper">
                🚗 Veículos da Frota ({selectedVehicles.length})
              </label>
              <button
                type="button"
                onClick={selectAllVehicles}
                className="text-xs text-accent hover:text-green transition"
              >
                Selecionar todos
              </button>
            </div>
            <div className="space-y-2 bg-ink-700/30 p-3 rounded border border-white/10 max-h-48 overflow-y-auto">
              {vehicles.length === 0 ? (
                <p className="text-paper-dim text-sm text-center py-4">
                  Nenhum veículo cadastrado
                </p>
              ) : (
                vehicles.map((v) => (
                  <label key={v.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedVehicles.includes(v.id)}
                      onChange={() => toggleVehicle(v.id)}
                      className="w-4 h-4 rounded accent-green"
                    />
                    <span className="text-paper text-sm font-mono">{v.plate}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Resumo */}
          {selectedVehicles.length > 0 && selectedConcessionaires.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
              <p className="text-green-300 text-sm">
                ✓ Serão criadas <strong>{selectedVehicles.length * selectedConcessionaires.length}</strong> solicitações
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || selectedVehicles.length === 0 || selectedConcessionaires.length === 0}
              className="flex-1"
            >
              {loading ? 'Criando...' : 'Solicitar Isenção'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
