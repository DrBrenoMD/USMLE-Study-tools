import React, { useState } from 'react';
import { Page } from '../App';
import { Archive, ScrollText } from 'lucide-react';
import { QuestionBanksView } from './QuestionBanksView';
import { NotebooksView } from './NotebooksView';
import { cn } from '../lib/utils';

export const LibraryView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'notebooks' | 'banks'>('notebooks');

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-6 border-b border-gray-200 dark:border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('notebooks')}
          className={cn(
            "pb-2 border-b-2 font-semibold text-sm sm:text-base flex items-center gap-2 transition-colors",
            activeTab === 'notebooks' ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <ScrollText className="w-4 h-4" />
          Cadernos (Notebooks)
        </button>
        <button
          onClick={() => setActiveTab('banks')}
          className={cn(
            "pb-2 border-b-2 font-semibold text-sm sm:text-base flex items-center gap-2 transition-colors",
            activeTab === 'banks' ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Archive className="w-4 h-4" />
          Bancos de Questões (QBanks)
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'notebooks' ? (
          <NotebooksView onNavigate={onNavigate} />
        ) : (
          <QuestionBanksView onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
};
