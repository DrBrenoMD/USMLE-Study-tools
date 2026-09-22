import React from 'react';
import { useStore } from '../store/useStore';
import { Page } from '../App';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, PieChart as PieChartIcon } from 'lucide-react';

export const DashboardView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { questions, cards, reviewHistory } = useStore();
  
  const subjects = questions.reduce((acc, q) => {
    if (!q.subject) return acc;
    acc[q.subject] = (acc[q.subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(subjects).map(([name, count]) => ({ name, count }));

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate({ type: 'home' })}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <PieChartIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Estatísticas & Dashboard
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-xs text-center">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total de Flashcards</div>
          <div className="text-4xl font-bold text-gray-900 dark:text-white">{cards.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-xs text-center">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Revisões Realizadas</div>
          <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{reviewHistory.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-xs text-center">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Questões de QBanks</div>
          <div className="text-4xl font-bold text-gray-900 dark:text-white">{questions.length}</div>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-xs h-80">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">Questões por Matéria</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data}>
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
              <Tooltip 
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#f8fafc' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 rounded-2xl text-center text-gray-500">
          Nenhum dado por matéria disponível ainda. Estude e revise para gerar métricas!
        </div>
      )}
    </div>
  );
};
