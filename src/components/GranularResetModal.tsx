import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  RotateCcw,
  AlertTriangle,
  X,
  Check,
  ShieldAlert,
  SlidersHorizontal,
  Layers,
  BookOpen
} from 'lucide-react';

interface GranularResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSubjects: string[];
  availableSystems: string[];
  onResetExtensionOnly: () => void;
  onResetSubject: (subject: string) => void;
  onResetSystem: (system: string) => void;
  onResetGeneralLogsOnly: () => void;
}

type ResetScope = 'extension' | 'subject' | 'system' | 'general_logs';

export const GranularResetModal: React.FC<GranularResetModalProps> = ({
  isOpen,
  onClose,
  availableSubjects,
  availableSystems,
  onResetExtensionOnly,
  onResetSubject,
  onResetSystem,
  onResetGeneralLogsOnly
}) => {
  const [scope, setScope] = useState<ResetScope>('extension');
  const [selectedSubject, setSelectedSubject] = useState<string>(availableSubjects[0] || '');
  const [selectedSystem, setSelectedSystem] = useState<string>(availableSystems[0] || '');
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  if (!isOpen) return null;

  const handleExecuteReset = () => {
    if (scope === 'extension') {
      onResetExtensionOnly();
    } else if (scope === 'subject') {
      onResetSubject(selectedSubject);
    } else if (scope === 'system') {
      onResetSystem(selectedSystem);
    } else if (scope === 'general_logs') {
      onResetGeneralLogsOnly();
    }
    setStep('select');
    onClose();
  };

  const getConfirmationMessage = () => {
    switch (scope) {
      case 'extension':
        return 'Todas as resoluções, acertos e estatísticas das questões capturadas pela extensão do navegador serão resetadas para o estado inicial. Seus cadernos de notas e logs de sessão NÃO serão afetados.';
      case 'subject':
        return `Todas as estatísticas e tentativas de questões associadas à matéria "${selectedSubject}" serão resetadas. As outras matérias e os logs gerais permanecerão intactos.`;
      case 'system':
        return `Todas as estatísticas e tentativas de questões associadas ao sistema "${selectedSystem}" serão resetadas. Os outros sistemas permanecerão intactos.`;
      case 'general_logs':
        return 'O banco de logs de sessão de estudo geral (gráfico geral e heatmap) será limpo. Suas questões e notas permanecerão salvas.';
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Reset Granular de Estatísticas
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Selecione com precisão cirúrgica o que deseja zerar
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

        {/* Body */}
        <div className="p-5 space-y-4">
          {step === 'select' ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                O que você deseja resetar?
              </label>

              {/* Opção 1: Resetar apenas dados da Extensão */}
              <label
                className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                  scope === 'extension'
                    ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 shadow-xs'
                    : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="resetScope"
                  checked={scope === 'extension'}
                  onChange={() => setScope('extension')}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🧩 Resetar apenas dados da Extensão</span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded font-mono">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    Zera apenas as resoluções e tentativas das questões capturadas pela extensão. Mantém todos os outros dados intactos.
                  </p>
                </div>
              </label>

              {/* Opção 2: Resetar por Subject específico */}
              <label
                className={`p-3.5 rounded-2xl border flex flex-col gap-2 cursor-pointer transition-all ${
                  scope === 'subject'
                    ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 shadow-xs'
                    : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="resetScope"
                    checked={scope === 'subject'}
                    onChange={() => setScope('subject')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">
                      📚 Resetar por Subject específico
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                      Escolha uma única matéria para zerar o histórico de acertos e tempo.
                    </p>
                  </div>
                </div>

                {scope === 'subject' && (
                  <div className="pl-7 pt-1">
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full p-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {availableSubjects.map((s) => (
                        <option key={s} value={s}>
                          Matéria: {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </label>

              {/* Opção 3: Resetar por System específico */}
              <label
                className={`p-3.5 rounded-2xl border flex flex-col gap-2 cursor-pointer transition-all ${
                  scope === 'system'
                    ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 shadow-xs'
                    : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="resetScope"
                    checked={scope === 'system'}
                    onChange={() => setScope('system')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">
                      🩺 Resetar por System específico
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                      Zera as estatísticas de um sistema corporal específico (ex: Cardiovascular, Renal).
                    </p>
                  </div>
                </div>

                {scope === 'system' && (
                  <div className="pl-7 pt-1">
                    <select
                      value={selectedSystem}
                      onChange={(e) => setSelectedSystem(e.target.value)}
                      className="w-full p-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {availableSystems.map((sys) => (
                        <option key={sys} value={sys}>
                          Sistema: {sys}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </label>

              {/* Opção 4: Resetar logs gerais */}
              <label
                className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                  scope === 'general_logs'
                    ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 shadow-xs'
                    : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="resetScope"
                  checked={scope === 'general_logs'}
                  onChange={() => setScope('general_logs')}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-gray-900 dark:text-white">
                    📅 Resetar apenas Logs Gerais de Estudo (Sessões)
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    Limpa o histórico diário do planejador sem remover nenhuma questão ou nota.
                  </p>
                </div>
              </label>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Confirmação Necessária</span>
              </div>
              <p className="text-xs text-rose-950 dark:text-rose-200 leading-relaxed">
                {getConfirmationMessage()}
              </p>
              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                ⚠️ Esta ação não pode ser desfeita. Tem certeza que deseja prosseguir?
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50/80 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
          {step === 'select' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Avançar para Reset</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('select')}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                className="px-5 py-2 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm shadow-rose-500/30 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sim, Resetar Agora</span>
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
