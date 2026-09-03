import React, { useState, useMemo } from 'react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Trash2, Calendar, Target, AlertTriangle, ArrowRight, Plus } from 'lucide-react';
import { useScores, SavedScore } from '../hooks/useScores';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MouseInteractiveBackground } from '../components/MouseInteractiveBackground';
import { Link } from 'react-router-dom';
import { AddScoreModal } from '../components/AddScoreModal';

export default function ScorePredictor() {
  const { scores, removeScore, addScore } = useScores();
  const [isAddingScore, setIsAddingScore] = useState(false);

  const step1Scores = scores.filter(s => s.step === 'Step 1').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const step2Scores = scores.filter(s => s.step === 'Step 2').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getStep1Prediction = () => {
    if (step1Scores.length === 0) return null;
    const recent = step1Scores.slice(-3); // avg of last 3
    const avgProb = recent.reduce((acc, s) => acc + (s.passProbability || 0), 0) / recent.length;
    return avgProb;
  };

  const getStep2Prediction = () => {
    if (step2Scores.length === 0) return null;
    const recent = step2Scores.slice(-3); // avg of last 3
    const avgScore = recent.reduce((acc, s) => acc + (s.estimatedScore || 0), 0) / recent.length;
    return Math.round(avgScore);
  };

  const step1Pred = getStep1Prediction();
  const step2Pred = getStep2Prediction();

  return (
    <div className="relative flex flex-1 flex-col items-center py-10 px-6 font-sans">
      <MouseInteractiveBackground />
      <div className="z-10 w-full max-w-5xl flex flex-col gap-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-gray-100">Score Predictor</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Acompanhe sua evolução e previsão de notas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsAddingScore(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-50 text-white rounded-xl font-bold hover:bg-black transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Simulado
            </button>
          </div>
        </div>

        {/* Predictions Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1 Prediction */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Previsão Step 1</h3>
            </div>
            {step1Pred !== null ? (
              <div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className={`text-5xl font-black ${step1Pred >= 95 ? 'text-emerald-600' : step1Pred >= 80 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600'}`}>
                  {step1Pred.toFixed(1)}%
                </div>
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-2 uppercase tracking-wider">Chance de Aprovação (Pass)</div>
                <div className="mt-4 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                  Baseado na média móvel dos últimos {Math.min(3, step1Scores.length)} simulados.
                </div>
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 border-dashed">
                <AlertTriangle className="w-6 h-6 mb-2 opacity-50" />
                <p className="text-sm font-medium">Nenhum simulado registrado</p>
              </div>
            )}
          </div>

          {/* Step 2 Prediction */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Previsão Step 2 CK</h3>
            </div>
            {step2Pred !== null ? (
              <div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="text-5xl font-black text-emerald-600">
                  {step2Pred}
                </div>
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-2 uppercase tracking-wider">Score 3-Dígitos Estimado</div>
                <div className="mt-4 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                  Baseado na média móvel dos últimos {Math.min(3, step2Scores.length)} simulados.
                </div>
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 border-dashed">
                <AlertTriangle className="w-6 h-6 mb-2 opacity-50" />
                <p className="text-sm font-medium">Nenhum simulado registrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Charts Section */}
        {scores.length > 0 && (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-8">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Evolução do Desempenho</h3>
            
            {step1Scores.length > 0 && (
              <div className="w-full h-72">
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Step 1 (% Acertos)</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={step1Scores} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="examName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Acertos']}
                      labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                    />
                    <ReferenceLine y={65} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Risco', fill: '#ef4444', fontSize: 10 }} />
                    <ReferenceLine y={70} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Seguro', fill: '#10b981', fontSize: 10 }} />
                    <Line type="monotone" dataKey="percentCorrect" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}

            {step2Scores.length > 0 && (
              <div className="w-full h-72">
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Step 2 CK (Score)</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={step2Scores} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="examName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis domain={[200, 300]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${value}`, 'Score']}
                      labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                    />
                    <Line type="monotone" dataKey="estimatedScore" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* History Table */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Histórico de Simulados</h3>
          </div>
          {scores.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              Nenhum simulado salvo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                <thead className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-y border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Exame</th>
                    <th className="px-4 py-3">Step</th>
                    <th className="px-4 py-3">Acertos</th>
                    <th className="px-4 py-3 text-right">Resultado</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scores.slice().reverse().map(score => (
                    <tr key={score.id} className="hover:bg-gray-50/50 dark:bg-gray-900 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        {format(new Date(score.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{score.examName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${score.step === 'Step 1' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-emerald-50 text-emerald-700'}`}>
                          {score.step}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {score.percentCorrect.toFixed(1)}% <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">({score.totalQuestions - score.incorrects}/{score.totalQuestions})</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">
                        {score.step === 'Step 1' ? (
                          score.percentCorrect < 55 ? <span className="text-red-600">LOW PASS</span> : `${score.passProbability?.toFixed(1)}% Pass`
                        ) : (
                          score.estimatedScore
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => removeScore(score.id)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <AddScoreModal 
        isOpen={isAddingScore} 
        onClose={() => setIsAddingScore(false)} 
        onSave={addScore} 
      />
    </div>
  );
}
