import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useTimerStore } from '../store/useTimerStore';

export function QuickLogModal() {
  const { showQuickLog, setShowQuickLog, quickLogDefaultQuestions } = useTimerStore();
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [correctPercent, setCorrectPercent] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [availableResources, setAvailableResources] = useState<any[]>([]);

  useEffect(() => {
    if (showQuickLog) {
      setAmount(quickLogDefaultQuestions || 0);
      setCorrectPercent('');
      const saved = localStorage.getItem('usmle_resources_v4');
      if (saved) {
        const res = JSON.parse(saved);
        setAvailableResources(res);
        if (res.length > 0) setSelectedResource(res[0].id);
      }
    }
  }, [showQuickLog, quickLogDefaultQuestions]);

  if (!showQuickLog) return null;

  const handleSave = () => {
    if (!selectedResource) return;
    
    const resource = availableResources.find(r => r.id === selectedResource);
    if (!resource) return;

    const savedLogs = localStorage.getItem('usmle_study_logs_v4');
    const logs = savedLogs ? JSON.parse(savedLogs) : [];

    logs.push({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      resourceId: resource.id,
      resourceName: resource.name,
      resourceType: resource.type,
      amount: amount,
      unit: 'questões',
      minutesSpent: 0, // Since it's a quick log, we might not track minutes precisely unless passed from pacer
      scorePercent: parseFloat(correctPercent) || undefined,
      notes: 'Registro Rápido',
      createdAt: new Date().toISOString()
    });

    localStorage.setItem('usmle_study_logs_v4', JSON.stringify(logs));
    window.dispatchEvent(new Event('usmle_logs_updated'));
    
    setShowQuickLog(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">Registro Rápido de Atividade</h3>
          <button onClick={() => setShowQuickLog(false)} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Banco de Questões / Recurso</label>
            <select
              value={selectedResource}
              onChange={(e) => setSelectedResource(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
            >
              <option value="" disabled>Selecione um recurso...</option>
              {availableResources.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {availableResources.length === 0 && (
              <p className="text-xs text-amber-600">Crie recursos no Tracker primeiro.</p>
            )}
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Número de Questões</label>
            <input 
              type="number" 
              value={amount}
              onChange={e => setAmount(parseInt(e.target.value) || 0)}
              min="0"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Porcentagem de Acertos (%)</label>
            <input 
              type="number" 
              value={correctPercent}
              onChange={e => setCorrectPercent(e.target.value)}
              min="0"
              max="100"
              placeholder="Opcional"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
          <button 
            onClick={() => setShowQuickLog(false)}
            className="flex-1 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:bg-gray-800/50 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={!selectedResource}
            className="flex-1 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
