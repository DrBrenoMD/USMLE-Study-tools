import React from 'react';
import { useStore } from '../store/useStore';
import { Page } from '../App';
import { Plus, BookOpen, Trash2, Play, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export const NotebooksView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { notebooks, deleteNotebook, questions, notebookHistory } = useStore();

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Cadernos de Questões (Notebooks)
          </h2>
          <p className="text-xs text-gray-500 mt-1">Crie blocos customizados de questões para treinar com tempo ou modo tutor.</p>
        </div>
        <button
          onClick={() => onNavigate({ type: 'notebookCreator' })}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Caderno
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {notebooks.map((nb) => {
          const qCount = nb.questionIds?.length || 0;
          const completedRuns = notebookHistory.filter(h => h.notebookId === nb.id);
          const lastRun = completedRuns[completedRuns.length - 1];

          return (
            <div
              key={nb.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 p-5 rounded-2xl shadow-xs transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {nb.name}
                      </h4>
                      {nb.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{nb.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir o caderno "${nb.name}"?`)) {
                        deleteNotebook(nb.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                <span className="text-gray-500">{qCount} questões</span>
                <button
                  onClick={() => onNavigate({ type: 'notebook', notebookId: nb.id })}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Iniciar Bloco
                </button>
              </div>
            </div>
          );
        })}

        {notebooks.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-800 rounded-2xl">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nenhum caderno criado ainda</p>
            <p className="text-xs text-gray-500 mt-1">Selecione questões dos seus bancos para montar um bloco de prova personalizado.</p>
          </div>
        )}
      </div>
    </div>
  );
};
