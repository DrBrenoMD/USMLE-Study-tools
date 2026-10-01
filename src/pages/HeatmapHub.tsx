import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heatmap } from '../cardblocks/components/Heatmap';
import { useStore } from '../cardblocks/store/useStore';
import {
  CalendarDays,
  Flame,
  BarChart2,
  Layers,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Award,
  Clock,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function HeatmapHub() {
  const navigate = useNavigate();
  const { cards, reviewHistory, questions, studyNotes, decks } = useStore();

  const totalReviews = reviewHistory.length;
  const now = Date.now();
  const dueCardsCount = cards.filter(c => c.repetition > 0 && c.nextReviewDate <= now && !c.isSuspended).length;
  const newCardsCount = cards.filter(c => c.repetition === 0 && !c.isSuspended).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in pb-28">
      {/* Header Banner */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 sm:p-8 rounded-3xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 via-amber-500 to-yellow-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 text-3xl select-none">
            🔥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Heatmap & Atividade de Estudo
              </h1>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 uppercase tracking-wider">
                Análise Contínua
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Visualize seu histórico diário de revisões, previsões futuras e consistência de estudo no algoritmo SM-2.
            </p>
          </div>
        </div>

        {/* Quick Action: Start Review */}
        <button
          onClick={() => navigate('/flashcards')}
          className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <Layers className="w-4 h-4" />
          <span>Iniciar Sessão de Estudo</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Revisões</span>
            <BarChart2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
            {totalReviews.toLocaleString('pt-BR')}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">respostas computadas</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pendentes Hoje</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {dueCardsCount.toLocaleString('pt-BR')}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">cards prontos para revisão</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Novos Cards</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {newCardsCount.toLocaleString('pt-BR')}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">cards ainda não iniciados</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cadernos & Notas</span>
            <BookOpen className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">
            {studyNotes.length}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">anotações estruturadas</p>
        </div>
      </div>

      {/* The Full Interactive Heatmap Component */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 sm:p-8 rounded-3xl shadow-xs">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
              Calendário e Previsão de Carga de Estudo
            </h2>
          </div>
          <span className="text-xs text-gray-400">Clique em qualquer dia para inspecionar</span>
        </div>

        <Heatmap onNavigate={(page) => {
          if (page.type === 'study') {
            navigate('/flashcards');
          }
        }} />
      </div>
    </div>
  );
}
