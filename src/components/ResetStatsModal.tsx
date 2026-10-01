import React, { useState } from 'react';
import { useStore } from '../cardblocks/store/useStore';
import {
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Clock,
  CheckSquare,
  Stethoscope,
  Trash2,
  HelpCircle,
  XCircle,
  FileText,
  Activity,
  Flame
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface ResetStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export function ResetStatsModal({ isOpen, onClose, onSuccess }: ResetStatsModalProps) {
  const {
    questions,
    studyDeskSessions,
    resetSubjectStats,
    resetSystemStats,
    resetDateStats,
    resetStatusStats,
    resetPerformanceTimes,
    resetStudyDeskSessions,
    resetManualStudyLogs,
    resetChronologicalStats,
    resetAllQuestionStats
  } = useStore();

  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    description: string;
    action: () => void;
  } | null>(null);

  if (!isOpen) return null;

  // Extrai apenas dados estritamente reais de questões respondidas
  const answeredQuestions = questions.filter(
    q => q.status === 'correct' || q.status === 'incorrect' || (q.attempts && q.attempts.length > 0) || Boolean(q.lastAnsweredAt)
  );

  const existingSubjects = Array.from(
    new Set(answeredQuestions.map(q => (q.subject || '').trim()).filter(Boolean))
  ) as string[];

  const existingSystems = Array.from(
    new Set(answeredQuestions.map(q => (q.system || '').trim()).filter(Boolean))
  ) as string[];

  // Extrai datas reais em que houve questões respondidas
  const existingDatesMap = new Map<string, number>();
  answeredQuestions.forEach(q => {
    if (q.lastAnsweredAt) {
      const d = new Date(q.lastAnsweredAt);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      existingDatesMap.set(dStr, (existingDatesMap.get(dStr) || 0) + 1);
    }
  });

  const existingDatesList = Array.from(existingDatesMap.entries())
    .map(([dateStr, count]) => ({ dateStr, count }))
    .sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  const handleConfirmAction = () => {
    if (confirmDialog) {
      confirmDialog.action();
      if (onSuccess) {
        onSuccess(confirmDialog.title);
      }
      setConfirmDialog(null);
    }
  };

  const correctCount = answeredQuestions.filter(q => q.status === 'correct').length;
  const incorrectCount = answeredQuestions.filter(q => q.status === 'incorrect').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
              <RotateCcw className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                Controle Individual de Reset de Estatísticas
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Zere exatamente a categoria ou data desejada sem perder o texto das suas questões capturadas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body com Controles Individuais */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* 1. Reset por Subject */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/60 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  1. Resetar por Matéria (Subject)
                </h4>
                <p className="text-[11px] text-gray-500">
                  Zera acertos, erros e histórico de resolução exclusivamente da matéria escolhida.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-1.5 font-medium text-gray-800 dark:text-gray-200 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os Subjects ({existingSubjects.length} matérias registradas)</option>
                {existingSubjects.map(s => {
                  const count = answeredQuestions.filter(q => (q.subject || '').trim() === s).length;
                  return (
                    <option key={s} value={s}>{s} ({count} questões respondidas)</option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => {
                  const targetLabel = selectedSubject === 'all' ? 'todos os Subjects' : `o Subject "${selectedSubject}"`;
                  setConfirmDialog({
                    show: true,
                    title: `Resetar estatísticas de ${targetLabel}`,
                    description: `As questões deste Subject voltarão para o status "Não respondida". O texto, alternativas e notas permanecerão intactos no banco.`,
                    action: () => resetSubjectStats(selectedSubject)
                  });
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer shrink-0 shadow-xs"
              >
                Zerar Matéria
              </button>
            </div>
          </div>

          {/* 2. Reset por System */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/60 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600">
                <Stethoscope className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  2. Resetar por Sistema Orgânico (System)
                </h4>
                <p className="text-[11px] text-gray-500">
                  Zera o histórico de desempenho apenas do sistema orgânico selecionado.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedSystem}
                onChange={(e) => setSelectedSystem(e.target.value)}
                className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-1.5 font-medium text-gray-800 dark:text-gray-200 flex-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Todos os Sistemas ({existingSystems.length} sistemas)</option>
                {existingSystems.map(s => {
                  const count = answeredQuestions.filter(q => (q.system || '').trim() === s).length;
                  return (
                    <option key={s} value={s}>{s} ({count} questões)</option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => {
                  const targetLabel = selectedSystem === 'all' ? 'todos os Sistemas' : `o Sistema "${selectedSystem}"`;
                  setConfirmDialog({
                    show: true,
                    title: `Resetar estatísticas de ${targetLabel}`,
                    description: `As questões deste Sistema voltarão para o status inicial.`,
                    action: () => resetSystemStats(selectedSystem)
                  });
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer shrink-0 shadow-xs"
              >
                Zerar Sistema
              </button>
            </div>
          </div>

          {/* 3. Reset por Data Específica */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/60 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  3. Resetar por Data Específica
                </h4>
                <p className="text-[11px] text-gray-500">
                  Limpa respostas registradas em um dia específico (remove o dia do gráfico diário e do histórico).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {existingDatesList.length === 0 ? (
                <span className="text-xs text-gray-400 italic py-1">Nenhuma data com respostas registrada.</span>
              ) : (
                <>
                  <select
                    value={selectedDate || existingDatesList[0]?.dateStr || ''}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-1.5 font-medium text-gray-800 dark:text-gray-200 flex-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  >
                    {existingDatesList.map(item => {
                      const [y, m, d] = item.dateStr.split('-');
                      return (
                        <option key={item.dateStr} value={item.dateStr}>
                          {d}/{m}/{y} ({item.count} questões respondidas)
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const targetDate = selectedDate || existingDatesList[0]?.dateStr;
                      if (!targetDate) return;
                      const [y, m, d] = targetDate.split('-');
                      setConfirmDialog({
                        show: true,
                        title: `Limpar registros da data ${d}/${m}/${y}`,
                        description: `As respostas dadas nessa data serão desvinculadas desse dia, limpando esse dia dos gráficos cronológicos.`,
                        action: () => resetDateStats(targetDate)
                      });
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shrink-0 shadow-xs"
                  >
                    Zerar Esta Data
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 4. Reset por Status (Apenas Acertos ou Apenas Erros) */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/60 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600">
                <CheckSquare className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  4. Resetar por Status de Resposta (Acertos vs Erros)
                </h4>
                <p className="text-[11px] text-gray-500">
                  Ideal para zerar apenas as questões que você errou e refazê-las, mantendo seus acertos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog({
                    show: true,
                    title: `Zerar apenas Questões Incorretas (${incorrectCount} erros)`,
                    description: `As questões que você errou voltarão para "Não respondidas" para você poder refazê-las do zero. Seus ${correctCount} acertos continuarão salvos.`,
                    action: () => resetStatusStats('incorrect')
                  });
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Zerar Apenas Erros ({incorrectCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmDialog({
                    show: true,
                    title: `Zerar apenas Questões Corretas (${correctCount} acertos)`,
                    description: `As questões acertadas voltarão ao status inicial.`,
                    action: () => resetStatusStats('correct')
                  });
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zerar Apenas Acertos ({correctCount})</span>
              </button>
            </div>
          </div>

          {/* 5. Reset de Tempos Médios de Resolução e Revisão */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600">
                <Clock className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  5. Resetar Métricas de Tempo (Resolução e Revisão)
                </h4>
                <p className="text-[11px] text-gray-500">
                  Zera os cronômetros e tempos médios registrados nas questões, sem alterar sua acurácia ou acertos.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmDialog({
                  show: true,
                  title: 'Resetar Contadores de Tempo',
                  description: 'Esta ação resetará o tempo médio de resolução e revisão para 0s em todas as questões.',
                  action: () => resetPerformanceTimes()
                });
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shrink-0 shadow-xs"
            >
              Zerar Tempos
            </button>
          </div>

          {/* 6. Reset dos Logs Manuais do Planner */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-600">
                <FileText className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  6. Limpar Logs Manuais de Estudo (Study Tracker / Planner)
                </h4>
                <p className="text-[11px] text-gray-500">
                  Exclui registros antigos inseridos manualmente no planejador de estudos que possam gerar dias vazios.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmDialog({
                  show: true,
                  title: 'Limpar Logs Manuais do Planner',
                  description: 'Esta ação apagará o histórico manual de logs do localStorage, mantendo suas questões capturadas intactas.',
                  action: () => resetManualStudyLogs()
                });
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-700 hover:bg-cyan-600 text-white transition-all cursor-pointer shrink-0 shadow-xs"
            >
              Limpar Logs
            </button>
          </div>

          {/* 7. Reset Cronológico (Linha do Tempo e Datas) */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-600">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  7. Resetar Linha do Tempo e Histórico Diário
                </h4>
                <p className="text-[11px] text-gray-500">
                  Limpa todas as datas de resposta e sessões do Desk, reiniciando o histórico a partir de hoje.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmDialog({
                  show: true,
                  title: 'Resetar Linha do Tempo e Histórico Diário',
                  description: 'Esta ação desvinculará as datas de respostas registradas, iniciando um histórico limpo a partir de agora.',
                  action: () => resetChronologicalStats()
                });
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white transition-all cursor-pointer shrink-0 shadow-xs"
            >
              Zerar Histórico
            </button>
          </div>

          {/* 8. Reset Geral de Todas as Questões */}
          <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600">
                <RotateCcw className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-rose-950 dark:text-rose-200">
                  8. Zerar TODAS as Estatísticas Gerais
                </h4>
                <p className="text-[11px] text-rose-700 dark:text-rose-400">
                  Retorna todas as questões para o status "Não respondida". Suas questões continuarão salvas no banco.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmDialog({
                  show: true,
                  title: 'Zerar TODAS as Estatísticas de Questões',
                  description: 'Tem certeza? Todas as questões capturadas voltarão ao status inicial não respondidas e todos os gráficos de rendimento serão zerados.',
                  action: () => resetAllQuestionStats()
                });
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shrink-0 shadow-xs"
            >
              Zerar Tudo
            </button>
          </div>
        </div>

        {/* Modal de Confirmação Interno */}
        {confirmDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
            <div className="bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">
                    {confirmDialog.title}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {confirmDialog.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs cursor-pointer"
                >
                  Confirmar Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
