import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Page } from '../App';
import { Plus, Archive, Trash2, Edit2, ChevronRight, Upload, HelpCircle } from 'lucide-react';
import { ImportBankModal } from '../components/ImportBankModal';

export const QuestionBanksView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { questionBanks, createQuestionBank, deleteQuestionBank, questions } = useStore();
  const [newBankName, setNewBankName] = useState('');
  const [newBankDesc, setNewBankDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return;
    createQuestionBank(newBankName.trim(), newBankDesc.trim());
    setNewBankName('');
    setNewBankDesc('');
    setIsCreating(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Archive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Bancos de Questões (QBanks)
          </h2>
          <p className="text-xs text-gray-500 mt-1">Gerencie seus repositórios de questões do USMLE e simulados.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar Questões
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Banco
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 space-y-3 shadow-md">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Criar Novo Banco de Questões</h3>
          <input
            type="text"
            placeholder="Nome do Banco (ex: UWorld Step 1 - Cardiologia)"
            value={newBankName}
            onChange={(e) => setNewBankName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <input
            type="text"
            placeholder="Descrição opcional..."
            value={newBankDesc}
            onChange={(e) => setNewBankDesc(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Salvar Banco
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {questionBanks.map((bank) => {
          const qCount = questions.filter(q => q.bankId === bank.id).length;
          return (
            <div
              key={bank.id}
              onClick={() => onNavigate({ type: 'bank', bankId: bank.id })}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 p-5 rounded-2xl shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Archive className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                        {bank.name}
                      </h4>
                      {bank.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{bank.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Excluir banco "${bank.name}" e todas as suas questões?`)) {
                        deleteQuestionBank(bank.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                <span>{qCount} {qCount === 1 ? 'questão' : 'questões'}</span>
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-1 transition-transform">
                  Ver Banco <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}

        {questionBanks.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-800 rounded-2xl">
            <Archive className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nenhum banco de questões encontrado</p>
            <p className="text-xs text-gray-500 mt-1">Crie um banco ou importe questões para começar a resolver blocos.</p>
          </div>
        )}
      </div>

      {isImportModalOpen && (
        <ImportBankModal onClose={() => setIsImportModalOpen(false)} />
      )}
    </div>
  );
};
