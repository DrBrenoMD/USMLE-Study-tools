import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  Award,
  TrendingUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  differenceInCalendarDays,
  format,
  addDays,
} from 'date-fns';
import { StudyPlan, Resource, getCategoryIcon, ResourceType } from '../types';

interface StudyTimelineProps {
  plan: StudyPlan;
  resources: Resource[];
  examDateStr?: string;
}

export const StudyTimeline: React.FC<StudyTimelineProps> = ({
  plan,
  resources,
}) => {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  if (!plan.isValid || plan.resourcesSchedule.length === 0) {
    return null;
  }

  const today = new Date();
  const startDate = today;
  const endDate = plan.examDate || plan.estimatedEndDate || addDays(today, 60);
  const totalCalendarDays = Math.max(1, differenceInCalendarDays(endDate, startDate));

  const resourceMap = new Map<string, Resource>(resources.map((r) => [r.id, r]));

  // Porcentagem no eixo de tempo
  const getTimelinePercent = (d: Date): number => {
    const diff = differenceInCalendarDays(d, startDate);
    const pct = (diff / totalCalendarDays) * 100;
    return Math.min(100, Math.max(0, pct));
  };

  // Cores consistentes com o tema claro e minimalista
  const getTypeColor = (type: ResourceType) => {
    switch (type) {
      case 'qbank':
        return {
          bg: 'bg-blue-600',
          barBg: 'bg-blue-100 border-blue-300 text-blue-900',
          badge: 'bg-blue-50 text-blue-700 border-blue-200',
          accent: 'border-blue-500',
          fill: 'bg-blue-500',
        };
      case 'book':
        return {
          bg: 'bg-emerald-600',
          barBg: 'bg-emerald-100 border-emerald-300 text-emerald-900',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          accent: 'border-emerald-500',
          fill: 'bg-emerald-500',
        };
      case 'video':
        return {
          bg: 'bg-violet-600',
          barBg: 'bg-violet-100 border-violet-300 text-violet-900',
          badge: 'bg-violet-50 text-violet-700 border-violet-200',
          accent: 'border-violet-500',
          fill: 'bg-violet-500',
        };
      case 'flashcard':
        return {
          bg: 'bg-amber-600',
          barBg: 'bg-amber-100 border-amber-300 text-amber-900',
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          accent: 'border-amber-500',
          fill: 'bg-amber-500',
        };
      case 'nbme':
        return {
          bg: 'bg-rose-600',
          barBg: 'bg-rose-100 border-rose-300 text-rose-900',
          badge: 'bg-rose-50 text-rose-700 border-rose-200',
          accent: 'border-rose-500',
          fill: 'bg-rose-500',
        };
      default:
        return {
          bg: 'bg-slate-600',
          barBg: 'bg-slate-100 border-slate-300 text-slate-900',
          badge: 'bg-slate-50 text-slate-700 border-slate-200',
          accent: 'border-slate-500',
          fill: 'bg-slate-500',
        };
    }
  };

  const bufferStartPct = plan.targetFinishDate
    ? getTimelinePercent(plan.targetFinishDate)
    : 100;
  const examPct = plan.examDate ? getTimelinePercent(plan.examDate) : 100;

  return (
    <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 tracking-tight">
              Linha do Tempo & Sequenciamento de Fases
            </h3>
            <p className="text-xs text-gray-500">
              Cronograma de início, término e carga diária prevista por matéria.
            </p>
          </div>
        </div>

        {/* Resumo de Marcos em tema claro */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Hoje: <strong className="text-gray-900">{format(today, 'dd/MM/yyyy')}</strong>
          </div>
          {plan.targetFinishDate && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Término: <strong className="text-blue-950">{format(plan.targetFinishDate, 'dd/MM/yyyy')}</strong>
            </div>
          )}
          {plan.examDate && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
              <Award className="w-3.5 h-3.5 text-rose-600" />
              Prova: <strong className="text-rose-950">{format(plan.examDate, 'dd/MM/yyyy')}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Régua de Tempo e Gráfico de Gantt */}
      <div className="space-y-3 pt-1">
        {/* Marcadores de Datas */}
        <div className="relative h-5 text-[11px] font-medium text-gray-500 select-none">
          <span className="absolute left-0 text-emerald-700 font-semibold flex items-center gap-1">
            📍 Hoje ({format(today, 'dd/MM')})
          </span>
          {plan.targetFinishDate && (
            <span
              className="absolute -translate-x-1/2 text-blue-700 font-medium hidden sm:inline-block"
              style={{ left: `${bufferStartPct}%` }}
            >
              🏁 Fim ({format(plan.targetFinishDate, 'dd/MM')})
            </span>
          )}
          {plan.examDate && (
            <span
              className="absolute right-0 text-rose-700 font-bold flex items-center gap-1"
            >
              🎯 Prova ({format(plan.examDate, 'dd/MM')})
            </span>
          )}
        </div>

        {/* Linha do Tempo e Barras de Matérias */}
        <div className="relative bg-gray-50/70 border border-gray-200 rounded-xl p-3.5 sm:p-4 space-y-3 overflow-hidden">
          {/* Faixa da Margem de Segurança / Revisão Final */}
          {plan.bufferDays > 0 && plan.targetFinishDate && plan.examDate && (
            <div
              className="absolute top-0 bottom-0 bg-emerald-100/50 border-l border-r border-emerald-300 pointer-events-none flex flex-col justify-end p-2 z-0"
              style={{
                left: `${bufferStartPct}%`,
                width: `${Math.max(2, examPct - bufferStartPct)}%`,
              }}
            >
              <div className="text-[10px] font-semibold text-emerald-800 whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                <span>Buffer ({plan.bufferDays}d revisão)</span>
              </div>
            </div>
          )}

          {/* Linha vertical do Hoje */}
          <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-emerald-500 z-10"></div>

          {/* Barras de cada Recurso */}
          <div className="space-y-2.5 relative z-10">
            {plan.resourcesSchedule.map((item) => {
              const res = resourceMap.get(item.resourceId);
              const Icon = getCategoryIcon(item.resourceType);
              const color = getTypeColor(item.resourceType);

              const startPct = getTimelinePercent(item.startDate);
              const endPct = getTimelinePercent(item.endDate);
              const widthPct = Math.max(4, endPct - startPct);

              const isCompleted = item.isCompleted || (res && res.total > 0 && res.completed >= res.total);
              const isSelected = selectedResourceId === item.resourceId;

              const totalCount = res?.total || 0;
              const completedCount = res?.completed || 0;
              const progressPct = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;

              return (
                <div
                  key={item.resourceId}
                  onClick={() => setSelectedResourceId(isSelected ? null : item.resourceId)}
                  className={`group relative rounded-xl border transition-all cursor-pointer p-3 ${
                    isSelected
                      ? 'bg-blue-50/40 border-blue-300 shadow-sm'
                      : isCompleted
                      ? 'bg-white/80 border-gray-200 opacity-90'
                      : item.activeNow
                      ? 'bg-white border-gray-200 hover:border-gray-300 shadow-xs'
                      : 'bg-white/60 border-dashed border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Linha Superior: Nome, Status e Datas */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border ${color.badge}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-xs sm:text-sm text-gray-900 truncate">
                        {item.resourceName}
                      </span>

                      {/* Badges de Status */}
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Concluído
                        </span>
                      ) : item.activeNow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Zap className="w-2.5 h-2.5" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Lock className="w-2.5 h-2.5" />
                          Aguardando {item.waitingFor || 'Fase Anterior'}
                        </span>
                      )}

                      {item.frequency !== 'daily' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          {item.frequency === 'weekly' ? 'Semanal' : 'Periódico'}
                          {item.exclusiveDaysReserved ? ` (${item.exclusiveDaysReserved}d exclusivos)` : ''}
                        </span>
                      )}
                    </div>

                    {/* Datas do período */}
                    <div className="text-xs text-gray-600 flex items-center gap-1.5 sm:gap-2">
                      <span className="text-gray-500">
                        {format(item.startDate, 'dd/MM/yyyy')}
                      </span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="font-semibold text-gray-800">
                        {format(item.endDate, 'dd/MM/yyyy')}
                      </span>
                      <span className="text-gray-400 text-[11px]">
                        ({differenceInCalendarDays(item.endDate, item.startDate) + 1}d)
                      </span>
                    </div>
                  </div>

                  {/* Barra Visual Gantt na Linha do Tempo */}
                  <div className="relative w-full h-5 bg-gray-100 rounded-md overflow-hidden border border-gray-200 my-1">
                    <div
                      className={`absolute top-0 bottom-0 rounded-[4px] transition-all border flex items-center px-2 text-[10px] font-semibold whitespace-nowrap overflow-hidden ${
                        isCompleted
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                          : item.activeNow
                          ? `${color.barBg}`
                          : 'bg-gray-100 border-gray-300 text-gray-500 border-dashed'
                      }`}
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                      }}
                    >
                      {/* Progresso interno se estiver ativo */}
                      {item.activeNow && progressPct > 0 && (
                        <div
                          className={`absolute left-0 top-0 bottom-0 opacity-30 ${color.fill}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      )}
                      <span className="relative z-10 truncate">
                        {isCompleted
                          ? '100% Concluído'
                          : item.activeNow
                          ? `${item.dailyAmount} ${item.unit}/dia • ${item.dailyMinutes} min/dia`
                          : `Ao iniciar: ${item.projectedDailyAmount || item.dailyAmount} ${item.unit}/dia`}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes e Carga Diária quando Ativo ou Quando Iniciar */}
                  <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {/* Informação de Pacing */}
                    <div className="flex items-center gap-3 text-gray-600">
                      {isCompleted ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Todas as {totalCount} {item.unit} concluídas.
                        </span>
                      ) : item.activeNow ? (
                        <>
                          <span className="flex items-center gap-1 text-gray-900 font-medium">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                            Carga Diária: <strong className="text-blue-700">{item.dailyAmount} {item.unit}/dia</strong>
                          </span>
                          <span className="flex items-center gap-1 text-gray-500">
                            <Clock className="w-3 h-3 text-gray-400" />
                            ~{item.dailyMinutes} min/dia ({item.availableStudyDays} dias úteis)
                          </span>
                          <span className="text-gray-500">
                            Restam: {item.remainingItems} {item.unit}
                          </span>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5 text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                          <Lock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                          <span>
                            <strong>Carga ao Iniciar ({format(item.startDate, 'dd/MM')}):</strong>{' '}
                            <span className="text-amber-950 font-bold">
                              {item.projectedDailyAmount || item.dailyAmount} {item.unit}/dia
                            </span>{' '}
                            (~{item.projectedDailyMinutes || item.dailyMinutes} min/dia) durante {item.availableStudyDays} dias úteis
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Barra de Progresso Real */}
                    {totalCount > 0 && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span>
                          {completedCount} / {totalCount} {item.unit} ({progressPct}%)
                        </span>
                        <div className="w-16 sm:w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isCompleted ? 'bg-emerald-500' : color.fill
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
