import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { CheckCircle2, Clock, Plus, Percent, FileText, Sparkles, BookOpen } from 'lucide-react';
import { Resource, StudyLogEntry } from '../types';
import { cn } from '../lib/utils';

interface DailyLogSectionProps {
  resources: Resource[];
  activeDateStr: string;
  onActiveDateChange: (dateStr: string) => void;
  onAddLog: (log: Omit<StudyLogEntry, 'id' | 'createdAt'>, syncWithResource: boolean) => void;
}

export function DailyLogSection({ resources, activeDateStr, onActiveDateChange, onAddLog }: DailyLogSectionProps) {
  const [selectedResourceId, setSelectedResourceId] = useState<string>(resources[0]?.id || '');
  const [amount, setAmount] = useState<number | ''>('');
  const [minutesSpent, setMinutesSpent] = useState<number | ''>('');
  const [scorePercent, setScorePercent] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [syncWithResource, setSyncWithResource] = useState<boolean>(true);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  // Garantir que seleciona um recurso válido se a lista mudar
  useEffect(() => {
    if (!resources.some(r => r.id === selectedResourceId) && resources.length > 0) {
      setSelectedResourceId(resources[0].id);
    }
  }, [resources, selectedResourceId]);

  const selectedResource = resources.find(r => r.id === selectedResourceId);

  // Atualizar valores padrão quando mudar o material selecionado
  useEffect(() => {
    if (selectedResource) {
      if (selectedResource.allocationMode === 'fixed_time') {
        const mins = selectedResource.fixedDailyMinutes || 60;
        setAmount(mins);
        setMinutesSpent(mins);
      } else if (selectedResource.type === 'nbme') {
        setAmount(1);
        setMinutesSpent(selectedResource.minutesPerItem || 300);
      } else {
        const defaultQty = selectedResource.type === 'qbank' ? 40 : selectedResource.type === 'book' ? 15 : 20;
        setAmount(defaultQty);
        setMinutesSpent(Math.round(defaultQty * (selectedResource.minutesPerItem || 2)));
      }
    }
  }, [selectedResourceId]);

  // Recalcular minutos estimados quando a quantidade muda
  const handleAmountChange = (val: number | '') => {
    setAmount(val);
    if (val !== '' && selectedResource) {
      if (selectedResource.allocationMode === 'fixed_time') {
        setMinutesSpent(val);
      } else {
        setMinutesSpent(Math.round(Number(val) * (selectedResource.minutesPerItem || 2)));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResource || amount === '' || Number(amount) <= 0) return;

    onAddLog(
      {
        date: activeDateStr,
        resourceId: selectedResource.id,
        resourceName: selectedResource.name || selectedResource.type.toUpperCase(),
        resourceType: selectedResource.type,
        amount: Number(amount),
        unit: selectedResource.allocationMode === 'fixed_time' ? 'minutos' : selectedResource.unit,
        minutesSpent: Number(minutesSpent) || Math.round(Number(amount) * (selectedResource.minutesPerItem || 2)),
        scorePercent: scorePercent !== '' ? Number(scorePercent) : undefined,
        notes: notes.trim() || undefined,
      },
      syncWithResource
    );

    // Reset notes e feedback
    setNotes('');
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  if (resources.length === 0) {
    return (
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-700/90 p-6 shadow-sm">
        <div className="text-center py-6">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Nenhum material cadastrado</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Adicione seus materiais de estudo na aba Planejamento para começar a registrar suas sessões diárias.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-700/90 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Lançamento Rápido de Progresso
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Insira o que você estudou hoje para atualizar suas metas e o heatmap.
          </p>
        </div>

        {showSuccessToast && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Progresso salvo com sucesso!
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Linha 1: Seleção de Data e Material */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          
          {/* Data */}
          <div className="sm:col-span-5">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold">
                Data da Sessão
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onActiveDateChange(todayStr)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer",
                    activeDateStr === todayStr ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 text-blue-700 dark:text-blue-300" : "bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:bg-gray-800"
                  )}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => onActiveDateChange(yesterdayStr)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer",
                    activeDateStr === yesterdayStr ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 text-blue-700 dark:text-blue-300" : "bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:bg-gray-800"
                  )}
                >
                  Ontem
                </button>
              </div>
            </div>
            <input
              type="date"
              value={activeDateStr}
              onChange={(e) => onActiveDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900"
            />
          </div>

          {/* Material de Estudo */}
          <div className="sm:col-span-7">
            <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
              Material Estudado
            </label>
            <select
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900 cursor-pointer"
            >
              {resources.map((res) => (
                <option key={res.id} value={res.id}>
                  {res.name || res.type.toUpperCase()} ({res.allocationMode === 'fixed_time' ? 'Tempo Reservado' : `${res.completed}/${res.total} ${res.unit}`})
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Linha 2: Quantidade, Tempo e % Acerto */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Quantidade Realizada */}
          <div>
            <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
              {selectedResource?.allocationMode === 'fixed_time' 
                ? 'Minutos Estudados' 
                : `Quantidade (${selectedResource?.unit || 'itens'})`}
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value ? Number(e.target.value) : '')}
                placeholder="40"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 dark:text-gray-500 font-medium pointer-events-none">
                {selectedResource?.allocationMode === 'fixed_time' ? 'min' : selectedResource?.unit}
              </span>
            </div>
          </div>

          {/* Tempo Dedicado */}
          <div>
            <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              Tempo Total Dedicado
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                value={minutesSpent}
                onChange={(e) => setMinutesSpent(e.target.value ? Number(e.target.value) : '')}
                placeholder="60"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 dark:text-gray-500 font-medium pointer-events-none">
                minutos
              </span>
            </div>
          </div>

          {/* % de Acerto (Opcional) */}
          <div>
            <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1 flex items-center gap-1">
              <Percent className="w-3 h-3 text-emerald-600" />
              % Acertos (Opcional)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={scorePercent}
                onChange={(e) => setScorePercent(e.target.value !== '' ? Number(e.target.value) : '')}
                placeholder="Ex: 72.5"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 dark:text-gray-500 font-medium pointer-events-none">
                %
              </span>
            </div>
          </div>

        </div>

        {/* Linha 3: Notas / Tópicos Estudados */}
        <div>
          <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1 flex items-center gap-1">
            <FileText className="w-3 h-3 text-gray-400 dark:text-gray-500" />
            Tópicos Estudados / Observações (Opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Farmacologia Cardíaca, Erros no NBME 26, Foco em Imunologia..."
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-gray-900"
          />
        </div>

        {/* Linha 4: Checkbox de sincronização e Botão de Ação */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={syncWithResource}
              onChange={(e) => setSyncWithResource(e.target.checked)}
              className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            />
            <span>Somar automaticamente à barra de progresso do material ({selectedResource?.name || 'Material'})</span>
          </label>

          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Lançar Registro
          </button>
        </div>

      </form>
    </section>
  );
}
