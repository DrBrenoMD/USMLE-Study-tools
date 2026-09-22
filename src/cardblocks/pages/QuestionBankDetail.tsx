import React, { useState } from 'react';
import { useStore, Question } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Plus, Trash2, Edit2, Archive, HelpCircle, ChevronRight, FileText } from 'lucide-react';
import { sanitizeHtml } from '../lib/utils';

export const QuestionBankDetail: React.FC<{
  bankId: string;
  onNavigate: (p: Page) => void;
}> = ({ bankId, onNavigate }) => {
  const { questionBanks, questions, deleteQuestion } = useStore();
  const bank = questionBanks.find(b => b.id === bankId);
  const bankQuestions = questions.filter(q => q.bankId === bankId);
  const [search, setSearch] = useState('');

  const filtered = bankQuestions.filter(q => {
    if (!search) return true;
    const term = search.toLowerCase();
    return q.text?.toLowerCase().includes(term) || q.subject?.toLowerCase().includes(term);
  });

  if (!bank) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-gray-500">Banco de questões não encontrado.</p>
        <button
          onClick={() => onNavigate({ type: 'banks' })}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
        >
          Voltar aos Bancos
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate({ type: 'banks' })}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Archive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              {bank.name}
            </h2>
            <p className="text-xs text-gray-500">{bankQuestions.length} questões cadastradas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate({ type: 'question', bankId })}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Questão
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar questões por texto, tema ou matéria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((q, idx) => (
          <div
            key={q.id}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-xs flex items-start justify-between gap-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg">
                  #{idx + 1}
                </span>
                {q.subject && (
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                    {q.subject}
                  </span>
                )}
                {q.topic && (
                  <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                    {q.topic}
                  </span>
                )}
              </div>
              <div
                className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.text) }}
              />
              <div className="mt-2 text-xs text-gray-400">
                {q.alternatives?.length || 0} alternativas
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onNavigate({ type: 'question', questionId: q.id, bankId })}
                className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Editar questão"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm("Excluir esta questão?")) {
                    deleteQuestion(q.id);
                  }
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Excluir questão"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            Nenhuma questão encontrada neste banco.
          </div>
        )}
      </div>
    </div>
  );
};
