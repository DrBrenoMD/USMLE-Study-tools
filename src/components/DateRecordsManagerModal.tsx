import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Trash2,
  CalendarDays,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  CheckSquare,
  BookOpen,
  Filter,
  X,
  RotateCcw,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { useStore, Question } from '../cardblocks/store/useStore';
import { StudyLogEntry } from '../types';
import { cn } from '../lib/utils';

interface DateRecordsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  onDateRecordsChanged?: () => void;
}

export const DateRecordsManagerModal: React.FC<DateRecordsManagerModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  onDateRecordsChanged,
}) => {
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    initialDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [targetMoveDateStr, setTargetMoveDateStr] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [filterBank, setFilterBank] = useState<string>('all');
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const { questions, questionBanks, studyDeskSessions } = useStore();

  // Carrega logs de sessão gerais do localStorage
  const sessionLogs = useMemo(() => {
    try {
      const saved = localStorage.getItem('usmle_study_logs_v4');
      if (saved) {
        const parsed: StudyLogEntry[] = JSON.parse(saved);
        return parsed.filter((l) => l.date === selectedDateStr);
      }
    } catch (e) {}
    return [];
  }, [selectedDateStr, toastMsg]);

  // Coleta todas as questões que possuem resolução ou tentativa na data selecionada
  const dayQuestionsData = useMemo(() => {
    const list: Array<{
      question: Question;
      attemptTimestamp?: number;
      isCorrect: boolean;
      solveTime: number;
      revTime: number;
      bankName: string;
      isReview?: boolean;
    }> = [];

    questions.forEach((q) => {
      const bank = questionBanks.find((b) => b.id === q.bankId);
      const bankName = bank ? bank.name : 'Banco Geral';

      if (filterBank !== 'all' && q.bankId !== filterBank) {
        return;
      }

      // 1. Verifica tentativas com timestamp na data selecionada
      if (q.attempts && q.attempts.length > 0) {
        q.attempts.forEach((att) => {
          if (att.timestamp) {
            const attDate = format(new Date(att.timestamp), 'yyyy-MM-dd');
            if (attDate === selectedDateStr) {
              list.push({
                question: q,
                attemptTimestamp: att.timestamp,
                isCorrect: att.isCorrect,
                solveTime: att.resolutionTimeSeconds || q.resolutionTimeSeconds || 60,
                revTime: att.reviewTimeSeconds || q.reviewTimeSeconds || 90,
                bankName,
                isReview: q.attempts && q.attempts.length > 1 && att.timestamp !== q.attempts[0].timestamp,
              });
            }
          }
        });
      } else if (q.lastAnsweredAt) {
        // Fallback para lastAnsweredAt
        const ansDate = format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd');
        if (ansDate === selectedDateStr && q.status && q.status !== 'unused') {
          list.push({
            question: q,
            attemptTimestamp: q.lastAnsweredAt,
            isCorrect: q.status === 'correct',
            solveTime: q.resolutionTimeSeconds || 60,
            revTime: q.reviewTimeSeconds || 90,
            bankName,
          });
        }
      }
    });

    return list;
  }, [questions, questionBanks, selectedDateStr, filterBank, toastMsg]);

  // Lista de todas as datas que contêm algum registro ou log para facilitar seleção rápida
  const availableDatesWithData = useMemo(() => {
    const dateSet = new Set<string>();

    try {
      const saved = localStorage.getItem('usmle_study_logs_v4');
      if (saved) {
        const parsed: StudyLogEntry[] = JSON.parse(saved);
        parsed.forEach((l) => {
          if (l.date) dateSet.add(l.date);
        });
      }
    } catch (e) {}

    questions.forEach((q) => {
      if (q.attempts) {
        q.attempts.forEach((att) => {
          if (att.timestamp) dateSet.add(format(new Date(att.timestamp), 'yyyy-MM-dd'));
        });
      }
      if (q.lastAnsweredAt) {
        dateSet.add(format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd'));
      }
    });

    return Array.from(dateSet).sort().reverse();
  }, [questions, toastMsg]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Excluir log de sessão individual do localStorage
  const handleDeleteSessionLog = (logId: string) => {
    try {
      const saved = localStorage.getItem('usmle_study_logs_v4');
      if (saved) {
        const logs: StudyLogEntry[] = JSON.parse(saved);
        const filtered = logs.filter((l) => l.id !== logId);
        localStorage.setItem('usmle_study_logs_v4', JSON.stringify(filtered));
        window.dispatchEvent(new Event('usmle_logs_updated'));
        showToast('Registro de log removido com sucesso!');
        if (onDateRecordsChanged) onDateRecordsChanged();
      }
    } catch (e) {}
  };

  // Excluir tentativa/resolução de uma questão específica nesta data
  const handleDeleteQuestionRecordOnDate = (questionId: string, timestamp?: number) => {
    const state = useStore.getState();
    const updatedQuestions = state.questions.map((q) => {
      if (q.id !== questionId && q.qid !== questionId) return q;

      const remainingAttempts = (q.attempts || []).filter((att) => {
        if (timestamp && att.timestamp) {
          return att.timestamp !== timestamp;
        }
        if (att.timestamp) {
          return format(new Date(att.timestamp), 'yyyy-MM-dd') !== selectedDateStr;
        }
        return false;
      });

      if (remainingAttempts.length === 0) {
        return {
          ...q,
          status: 'unused' as const,
          selectedChoiceId: undefined,
          resolutionTimeSeconds: 0,
          reviewTimeSeconds: 0,
          attempts: [],
          lastAnsweredAt: undefined,
          updatedAt: Date.now(),
        };
      } else {
        const lastAtt = remainingAttempts[remainingAttempts.length - 1];
        return {
          ...q,
          status: lastAtt.isCorrect ? ('correct' as const) : ('incorrect' as const),
          selectedChoiceId: lastAtt.selectedChoiceId,
          resolutionTimeSeconds: lastAtt.resolutionTimeSeconds || 60,
          reviewTimeSeconds: lastAtt.reviewTimeSeconds || 90,
          attempts: remainingAttempts,
          lastAnsweredAt: lastAtt.timestamp,
          updatedAt: Date.now(),
        };
      }
    });

    useStore.setState({ questions: updatedQuestions });

    // Atualiza contagem no log do dia se houver
    try {
      const saved = localStorage.getItem('usmle_study_logs_v4');
      if (saved) {
        const logs: StudyLogEntry[] = JSON.parse(saved);
        const dayLogIdx = logs.findIndex((l) => l.date === selectedDateStr);
        if (dayLogIdx >= 0) {
          const log = logs[dayLogIdx];
          const newAmount = Math.max(0, (log.amount || 1) - 1);
          if (newAmount === 0) {
            logs.splice(dayLogIdx, 1);
          } else {
            log.amount = newAmount;
          }
          localStorage.setItem('usmle_study_logs_v4', JSON.stringify(logs));
          window.dispatchEvent(new Event('usmle_logs_updated'));
        }
      }
    } catch (e) {}

    showToast('Registro da questão nesta data excluído com sucesso!');
    if (onDateRecordsChanged) onDateRecordsChanged();
  };

  // Mudar a data de uma questão específica
  const handleMoveQuestionDate = (questionId: string, timestamp?: number) => {
    if (!targetMoveDateStr || targetMoveDateStr === selectedDateStr) {
      showToast('Selecione uma data de destino diferente para transferir a questão.');
      return;
    }

    const [y, m, d] = targetMoveDateStr.split('-').map(Number);
    const newTimestamp = new Date(y, m - 1, d, 12, 0, 0).getTime();

    const state = useStore.getState();
    const updatedQuestions = state.questions.map((q) => {
      if (q.id !== questionId && q.qid !== questionId) return q;

      const updatedAttempts = (q.attempts || []).map((att) => {
        const isTarget = timestamp
          ? att.timestamp === timestamp
          : att.timestamp && format(new Date(att.timestamp), 'yyyy-MM-dd') === selectedDateStr;

        if (isTarget) {
          return {
            ...att,
            timestamp: newTimestamp,
          };
        }
        return att;
      });

      return {
        ...q,
        attempts: updatedAttempts,
        lastAnsweredAt: q.lastAnsweredAt ? newTimestamp : undefined,
        updatedAt: Date.now(),
      };
    });

    useStore.setState({ questions: updatedQuestions });

    showToast(`Questão transferida para a data ${format(parseISO(targetMoveDateStr), 'dd/MM/yyyy')} com sucesso!`);
    if (onDateRecordsChanged) onDateRecordsChanged();
  };

  // Excluir TODOS os registros e logs da data selecionada
  const handleDeleteAllRecordsForDate = () => {
    // 1. Limpa nas questões
    const state = useStore.getState();
    const updatedQuestions = state.questions.map((q) => {
      const qAnswerDate = q.lastAnsweredAt
        ? format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd')
        : null;
      const hasAttemptsOnDate = (q.attempts || []).some(
        (att) => att.timestamp && format(new Date(att.timestamp), 'yyyy-MM-dd') === selectedDateStr
      );

      if (qAnswerDate !== selectedDateStr && !hasAttemptsOnDate) {
        return q;
      }

      const remainingAttempts = (q.attempts || []).filter((att) => {
        if (!att.timestamp) return false;
        return format(new Date(att.timestamp), 'yyyy-MM-dd') !== selectedDateStr;
      });

      if (remainingAttempts.length === 0) {
        return {
          ...q,
          status: 'unused' as const,
          selectedChoiceId: undefined,
          resolutionTimeSeconds: 0,
          reviewTimeSeconds: 0,
          attempts: [],
          lastAnsweredAt: undefined,
          updatedAt: Date.now(),
        };
      } else {
        const lastAtt = remainingAttempts[remainingAttempts.length - 1];
        return {
          ...q,
          status: lastAtt.isCorrect ? ('correct' as const) : ('incorrect' as const),
          selectedChoiceId: lastAtt.selectedChoiceId,
          resolutionTimeSeconds: lastAtt.resolutionTimeSeconds || 60,
          reviewTimeSeconds: lastAtt.reviewTimeSeconds || 90,
          attempts: remainingAttempts,
          lastAnsweredAt: lastAtt.timestamp,
          updatedAt: Date.now(),
        };
      }
    });

    // 2. Limpa nas sessões de desk
    const updatedSessions = (state.studyDeskSessions || []).map((s) => {
      const remainingRecords = (s.questionRecords || []).filter((r) => {
        const rDate = r.answeredAt
          ? format(new Date(r.answeredAt), 'yyyy-MM-dd')
          : format(new Date(s.startedAt), 'yyyy-MM-dd');
        return rDate !== selectedDateStr;
      });
      const correctCount = remainingRecords.filter((r) => r.isCorrect).length;
      return {
        ...s,
        completedQuestions: remainingRecords.length,
        correctCount,
        incorrectCount: remainingRecords.length - correctCount,
        questionRecords: remainingRecords,
      };
    });

    useStore.setState({ questions: updatedQuestions, studyDeskSessions: updatedSessions });

    // 3. Limpa logs no localStorage
    try {
      const saved = localStorage.getItem('usmle_study_logs_v4');
      if (saved) {
        const logs: StudyLogEntry[] = JSON.parse(saved);
        const filtered = logs.filter((l) => l.date !== selectedDateStr);
        localStorage.setItem('usmle_study_logs_v4', JSON.stringify(filtered));
        window.dispatchEvent(new Event('usmle_logs_updated'));
      }
    } catch (e) {}

    setConfirmDeleteAllOpen(false);
    showToast(`Todos os registros da data ${format(parseISO(selectedDateStr), 'dd/MM/yyyy')} foram excluídos com sucesso!`);
    if (onDateRecordsChanged) onDateRecordsChanged();
  };

  // Mover todas as questões desta data para outra data
  const handleMoveAllQuestionsToDate = () => {
    if (!targetMoveDateStr || targetMoveDateStr === selectedDateStr) {
      showToast('Escolha uma data de destino diferente para transferir.');
      return;
    }

    const [y, m, d] = targetMoveDateStr.split('-').map(Number);
    const newTimestamp = new Date(y, m - 1, d, 12, 0, 0).getTime();

    const state = useStore.getState();
    let movedCount = 0;

    const updatedQuestions = state.questions.map((q) => {
      let changed = false;
      const updatedAttempts = (q.attempts || []).map((att) => {
        if (att.timestamp && format(new Date(att.timestamp), 'yyyy-MM-dd') === selectedDateStr) {
          changed = true;
          return { ...att, timestamp: newTimestamp };
        }
        return att;
      });

      const ansDate = q.lastAnsweredAt ? format(new Date(q.lastAnsweredAt), 'yyyy-MM-dd') : null;
      if (ansDate === selectedDateStr) {
        changed = true;
      }

      if (changed) {
        movedCount++;
        return {
          ...q,
          attempts: updatedAttempts,
          lastAnsweredAt: ansDate === selectedDateStr ? newTimestamp : q.lastAnsweredAt,
          updatedAt: Date.now(),
        };
      }
      return q;
    });

    useStore.setState({ questions: updatedQuestions });

    // Atualiza também os logs de estudo
    try {
      const saved = localStorage.getItem('usmle_study_logs_v4');
      if (saved) {
        const logs: StudyLogEntry[] = JSON.parse(saved);
        const updatedLogs = logs.map((l) => {
          if (l.date === selectedDateStr) {
            return { ...l, date: targetMoveDateStr };
          }
          return l;
        });
        localStorage.setItem('usmle_study_logs_v4', JSON.stringify(updatedLogs));
        window.dispatchEvent(new Event('usmle_logs_updated'));
      }
    } catch (e) {}

    showToast(`${movedCount} questões transferidas de ${format(parseISO(selectedDateStr), 'dd/MM/yyyy')} para ${format(parseISO(targetMoveDateStr), 'dd/MM/yyyy')}!`);
    setSelectedDateStr(targetMoveDateStr);
    if (onDateRecordsChanged) onDateRecordsChanged();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Gerenciador de Registros por Data</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Cirúrgico
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Corrija questões registradas na data errada, exclua tentativas específicas ou remova distorções de revisões.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-2xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg(null)} className="text-emerald-600 font-extrabold text-xs">✕</button>
          </div>
        )}

        {/* Controls Bar: Data Picker & Quick Dates */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Data a Inspecionar / Corrigir
              </label>
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => setSelectedDateStr(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filtro por Banco */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Filtrar Banco
              </label>
              <select
                value={filterBank}
                onChange={(e) => setFilterBank(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Todos os Bancos</option>
                {questionBanks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Date Badges with Data */}
          {availableDatesWithData.length > 0 && (
            <div className="flex flex-col items-start md:items-end">
              <span className="text-[10px] font-bold uppercase text-gray-400 mb-1">
                Datas Recentes com Registros:
              </span>
              <div className="flex flex-wrap gap-1 max-w-xs">
                {availableDatesWithData.slice(0, 5).map((dStr) => (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => setSelectedDateStr(dStr)}
                    className={cn(
                      'px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer',
                      selectedDateStr === dStr
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    )}
                  >
                    {format(parseISO(dStr), 'dd/MM')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Bar for Selected Date */}
        <div className="px-5 py-3 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/40 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 dark:text-gray-200">
              {format(parseISO(selectedDateStr), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}:
            </span>
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              {dayQuestionsData.length} questões encontradas • {sessionLogs.length} logs de sessão
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Transferir todas para outra data */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2 py-1 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-[10px] text-gray-500 font-bold">Mover todas para:</span>
              <input
                type="date"
                value={targetMoveDateStr}
                onChange={(e) => setTargetMoveDateStr(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-gray-800 dark:text-gray-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleMoveAllQuestionsToDate}
                disabled={dayQuestionsData.length === 0}
                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                title="Transferir todas as questões desta data para a nova data selecionada"
              >
                Transferir
              </button>
            </div>

            {/* Excluir todos os registros desta data */}
            <button
              type="button"
              onClick={() => setConfirmDeleteAllOpen(true)}
              disabled={dayQuestionsData.length === 0 && sessionLogs.length === 0}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              title="Excluir completamente todos os registros desta data"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Zerar Data</span>
            </button>
          </div>
        </div>

        {/* Modal de Confirmação de Exclusão Total da Data */}
        {confirmDeleteAllOpen && (
          <div className="mx-5 my-3 p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-2xl flex flex-col gap-3">
            <div className="flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Atenção: Excluir todos os registros de {format(parseISO(selectedDateStr), 'dd/MM/yyyy')}?</strong>
                Esta ação removerá todas as tentativas e logs de sessão registrados nesta data. As questões não serão deletadas do seu banco, apenas os registros de resolução desta data.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteAllOpen(false)}
                className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAllRecordsForDate}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        )}

        {/* Content Scrollable List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* SEÇÃO 1: QUESTÕES & RESOLUÇÕES DESTA DATA */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-blue-600" />
                <span>Questões Resolvidas / Registradas ({dayQuestionsData.length})</span>
              </h4>
              <span className="text-[11px] text-gray-400">
                Você pode excluir ou transferir individualmente
              </span>
            </div>

            {dayQuestionsData.length === 0 ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-xs text-gray-400">
                Nenhuma questão registrada especificamente para a data {format(parseISO(selectedDateStr), 'dd/MM/yyyy')}.
              </div>
            ) : (
              <div className="space-y-2">
                {dayQuestionsData.map((item, idx) => {
                  const q = item.question;
                  const timeFormatted = `${Math.floor(item.solveTime / 60)}m ${item.solveTime % 60}s`;

                  return (
                    <div
                      key={`${q.id}-${item.attemptTimestamp || idx}`}
                      className="p-3 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div
                          className={cn(
                            'p-1.5 rounded-lg shrink-0 mt-0.5 font-bold flex items-center justify-center',
                            item.isCorrect
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          )}
                        >
                          {item.isCorrect ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono font-bold text-gray-900 dark:text-white">
                              {q.qid ? `QID: ${q.qid}` : 'Questão'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                              {item.bankName}
                            </span>
                            {q.subject && (
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium text-[10px]">
                                {q.subject}
                              </span>
                            )}
                            {item.isReview && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                                🔄 Revisão
                              </span>
                            )}
                          </div>

                          <p className="text-gray-600 dark:text-gray-300 line-clamp-1 text-xs">
                            {q.stem || q.text || 'Sem enunciado'}
                          </p>

                          <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                            <span>Tempo de resolução: <strong>{timeFormatted}</strong></span>
                            {item.attemptTimestamp && (
                              <span>Hora: {format(new Date(item.attemptTimestamp), 'HH:mm:ss')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação Individual */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleMoveQuestionDate(q.id, item.attemptTimestamp)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title={`Mover para ${targetMoveDateStr}`}
                        >
                          <ArrowRight className="w-3 h-3 text-blue-500" />
                          <span>Mover p/ Destino</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteQuestionRecordOnDate(q.id, item.attemptTimestamp)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Excluir esta tentativa desta data"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SEÇÃO 2: LOGS DE SESSÃO DO HEATMAP NESTA DATA */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-600" />
                <span>Logs de Estudo / Sessão do Heatmap ({sessionLogs.length})</span>
              </h4>
            </div>

            {sessionLogs.length === 0 ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-xs text-gray-400">
                Nenhum log de sessão manual ou sincronizado nesta data.
              </div>
            ) : (
              <div className="space-y-2">
                {sessionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs shadow-xs"
                  >
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">
                        {log.resourceName}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        {log.amount} {log.unit} • {log.minutesSpent} min
                        {log.scorePercent !== undefined && (
                          <span className="font-bold text-emerald-600 ml-1.5">
                            ({log.scorePercent}% acertos)
                          </span>
                        )}
                      </div>
                      {log.notes && (
                        <div className="text-[10px] text-gray-400 italic mt-0.5">
                          {log.notes}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSessionLog(log.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Excluir este log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-gray-500">
            Dica: Ao transferir ou excluir questões de uma data errada, os gráficos são recalculados imediatamente.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Concluir & Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
};
