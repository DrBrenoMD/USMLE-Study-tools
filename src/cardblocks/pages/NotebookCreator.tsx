import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Save, CheckSquare, Square, Search, BookOpen } from 'lucide-react';
import { sanitizeHtml } from '../lib/utils';

export const NotebookCreator: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { questions, questionBanks, createNotebook } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const filtered = questions.filter(q => {
    if (selectedBankId !== 'all' && q.bankId !== selectedBankId) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return q.text?.toLowerCase().includes(term) || q.subject?.toLowerCase().includes(term);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allFilteredIds = filtered.map(q => q.id);
    setSelectedIds(allFilteredIds);
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleCreate = () => {
    if (!name.trim()) {
      alert("Digite o nome do caderno.");
      return;
    }
    if (selectedIds.length === 0) {
      alert("Selecione pelo menos uma questão para o caderno.");
      return;
    }

    const nbId = createNotebook(name.trim(), selectedIds, description.trim());
    onNavigate({ type: 'notebook', notebookId: nbId });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate({ type: 'notebooks' })}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Novo Caderno de Questões
            </h2>
            <p className="text-xs text-gray-500">{selectedIds.length} questões selecionadas</p>
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          Salvar e Iniciar
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nome do Caderno</label>
            <input
              type="text"
              placeholder="ex: Simulado Rápido de Cardio (40Q)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Descrição</label>
            <input
              type="text"
              placeholder="Descrição opcional..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Question Selection Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-xs font-semibold"
            >
              <option value="all">Todos os Bancos</option>
              {questionBanks.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              onClick={selectAll}
              className="px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Selecionar Todas ({filtered.length})
            </button>
            <button
              onClick={deselectAll}
              className="px-2.5 py-1.5 text-xs text-gray-500 hover:underline"
            >
              Limpar Seleção
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Filtrar por texto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-60 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-xs"
            />
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filtered.map(q => {
            const isSelected = selectedIds.includes(q.id);
            return (
              <div
                key={q.id}
                onClick={() => toggleSelect(q.id)}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
              >
                <div className="text-blue-600 dark:text-blue-400">
                  {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  {q.subject && (
                    <span className="text-[11px] font-semibold text-gray-500 mr-2 uppercase">
                      [{q.subject}]
                    </span>
                  )}
                  <span
                    className="text-xs text-gray-800 dark:text-gray-200 line-clamp-1"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.text) }}
                  />
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-center py-8 text-xs text-gray-500">Nenhuma questão encontrada com os filtros atuais.</p>
          )}
        </div>
      </div>
    </div>
  );
};
