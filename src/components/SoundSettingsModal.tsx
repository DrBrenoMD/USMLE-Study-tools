import React from 'react';
import { Volume2, VolumeX, Bell, Check, BookOpen, FastForward, RotateCcw, X, Play, Music, Sparkles, Sliders, ShieldCheck } from 'lucide-react';
import { useTimerStore, PacerSoundSettings } from '../store/useTimerStore';
import { audioManager } from '../services/audioManager';

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    pacerSoundSettings,
    setPacerSoundSettings,
    togglePacerSoundSetting
  } = useTimerStore();

  if (!isOpen) return null;

  const currentVolume = pacerSoundSettings.volume ?? 0.85;
  const isKeepAlive = pacerSoundSettings.keepAliveAudio !== false;

  const handleVolumeChange = (newVol: number) => {
    setPacerSoundSettings({ volume: newVol });
  };

  const handleToggleKeepAlive = () => {
    const nextVal = !isKeepAlive;
    setPacerSoundSettings({ keepAliveAudio: nextVal });
    if (nextVal) {
      audioManager.startKeepAlive();
    } else {
      audioManager.stopKeepAlive();
    }
  };

  const soundItems: Array<{
    key: keyof Omit<PacerSoundSettings, 'master' | 'keepAliveAudio' | 'volume'>;
    title: string;
    description: string;
    badge: string;
    icon: React.ReactNode;
    color: string;
    onTest: () => void;
  }> = [
    {
      key: 'solveAlarm',
      title: 'Alarme de Resolução / Questão',
      description: 'Sinal sonoro quando atinge o tempo alvo ou pace antecipado da resolução (880 Hz).',
      badge: '880 Hz',
      icon: <Bell className="w-4 h-4" />,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
      onTest: () => audioManager.playSolveAlarm(currentVolume)
    },
    {
      key: 'reviewAlarm',
      title: 'Alarme de Revisão (Modo Tutored)',
      description: 'Sinal sonoro quando atinge o tempo alvo ou pace antecipado da leitura do gabarito (660 Hz).',
      badge: '660 Hz',
      icon: <BookOpen className="w-4 h-4" />,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
      onTest: () => audioManager.playReviewAlarm(currentVolume)
    },
    {
      key: 'cycleAlarm',
      title: 'Alarme de Ciclo Pomodoro / Timer',
      description: 'Toque melodioso emitido ao zerar o tempo do bloco de estudo ou descanso.',
      badge: 'Melodia',
      icon: <Music className="w-4 h-4" />,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      onTest: () => audioManager.playCycleAlarm(currentVolume)
    },
    {
      key: 'nextQuestion',
      title: 'Som ao Avançar Questão (Next)',
      description: 'Beep curto de confirmação ao clicar em Next ou avançar no banco de questões.',
      badge: 'Ação',
      icon: <FastForward className="w-4 h-4" />,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
      onTest: () => audioManager.playActionBeep('next', currentVolume)
    },
    {
      key: 'submitQuestion',
      title: 'Som ao Enviar Gabarito (Submit)',
      description: 'Beep de transição ao clicar em Submit e abrir a revisão da explicação.',
      badge: 'Ação',
      icon: <Check className="w-4 h-4" />,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
      onTest: () => audioManager.playActionBeep('submit', currentVolume)
    },
    {
      key: 'prevQuestion',
      title: 'Som ao Retornar Questão (Anterior)',
      description: 'Beep suave ao retornar para a questão anterior ou voltar para a fase de resolução.',
      badge: 'Ação',
      icon: <RotateCcw className="w-4 h-4" />,
      color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
      onTest: () => audioManager.playActionBeep('prev', currentVolume)
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-gray-900 dark:text-gray-100">
                Configurações de Sons e Alertas
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Personalize o volume, alertas do pacer e prevenção de standby
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Controls Section */}
        <div className="p-4 mx-6 mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${pacerSoundSettings.master ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500'}`}>
                {pacerSoundSettings.master ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 block">
                  Som Geral (Master)
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {pacerSoundSettings.master ? 'Todos os sons respeitam as opções abaixo' : 'Todos os sons estão silenciados'}
                </span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={pacerSoundSettings.master}
                onChange={() => togglePacerSoundSetting('master')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Volume Slider */}
          <div className={`pt-2 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between gap-4 ${!pacerSoundSettings.master ? 'opacity-40 pointer-events-none' : ''}`}>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 min-w-[120px]">
              <Sliders className="w-3.5 h-3.5 text-blue-500" />
              Volume dos Alertas:
            </span>
            <div className="flex items-center gap-3 flex-1 max-w-xs">
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.05"
                value={currentVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300 w-10 text-right">
                {Math.round(currentVolume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Keep-Alive / Anti-Sleep Audio Feature */}
        <div className="mx-6 mt-3 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  Anti-Standby de Áudio (Keep-Alive Ativo)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                  Recomendado
                </span>
              </div>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5 leading-snug">
                Mantém fones Bluetooth e placa de som aquecidos em segundo plano com sinal inaudível, garantindo que o início dos alarmes nunca seja cortado.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={isKeepAlive}
              onChange={handleToggleKeepAlive}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Individual Sound Toggles List */}
        <div className="overflow-y-auto px-6 py-4 space-y-2.5 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            Controle Individual por Tipo de Som
          </div>

          {soundItems.map((item) => {
            const isEnabled = pacerSoundSettings[item.key];
            const isDimmed = !pacerSoundSettings.master;

            return (
              <div
                key={item.key}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isDimmed 
                    ? 'opacity-50 border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30' 
                    : isEnabled
                      ? 'border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800/50 shadow-xs'
                      : 'border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${item.color}`}>
                    {item.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${isEnabled && !isDimmed ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                        {item.title}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={item.onTest}
                    title="Testar este som"
                    className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isDimmed}
                      checked={isEnabled}
                      onChange={() => togglePacerSoundSetting(item.key)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPacerSoundSettings({
                  solveAlarm: true,
                  reviewAlarm: true,
                  cycleAlarm: true,
                  nextQuestion: true,
                  submitQuestion: true,
                  prevQuestion: true,
                });
              }}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Ativar Todos
            </button>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <button
              onClick={() => {
                setPacerSoundSettings({
                  solveAlarm: false,
                  reviewAlarm: false,
                  cycleAlarm: false,
                  nextQuestion: false,
                  submitQuestion: false,
                  prevQuestion: false,
                });
              }}
              className="text-xs font-semibold text-gray-500 hover:underline cursor-pointer"
            >
              Silenciar Todos
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-xs font-bold hover:bg-black dark:hover:bg-white transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};

