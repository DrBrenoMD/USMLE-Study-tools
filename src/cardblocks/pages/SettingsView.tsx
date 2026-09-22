import React, { useState, useRef, useEffect, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useStore } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Save, Download, Upload, RotateCcw, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { formatShortcutEvent } from '../lib/utils';

interface SettingsViewProps {
  onNavigate: (page: Page) => void;
}

export function SettingsView({ onNavigate }: SettingsViewProps) {
  const { settings, updateSettings, importProfile, resetSettings, resetAllData, decks, cards } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  
  const [theme, setTheme] = useState(settings.theme || 'ocean');
  const [language, setLanguage] = useState(settings.language || 'pt');
  const [againMinutes, setAgainMinutes] = useState(settings.againMinutes);
  const [hardMultiplier, setHardMultiplier] = useState(settings.hardMultiplier);
  const [hardMinMinutes, setHardMinMinutes] = useState(settings.hardMinMinutes);
  const [goodMultiplier, setGoodMultiplier] = useState(settings.goodMultiplier);
  const [easyMultiplier, setEasyMultiplier] = useState(settings.easyMultiplier);
  const [cardsPerBlock, setCardsPerBlock] = useState(settings.cardsPerBlock);
  const [cardOrder, setCardOrder] = useState(settings.cardOrder || 'newFirst');
  
  const [newAgainMinutes, setNewAgainMinutes] = useState(settings.newAgainMinutes);
  const [newHardMinutes, setNewHardMinutes] = useState(settings.newHardMinutes);
  const [newGoodMinutes, setNewGoodMinutes] = useState(settings.newGoodMinutes);
  const [newEasyMinutes, setNewEasyMinutes] = useState(settings.newEasyMinutes);

  const [ttsVoiceURI, setTtsVoiceURI] = useState(settings.ttsVoiceURI || '');
  const [ttsRate, setTtsRate] = useState(settings.ttsRate || 1);
  const [ttsPitch, setTtsPitch] = useState(settings.ttsPitch || 1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsLangFilter, setTtsLangFilter] = useState('');

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        setAvailableVoices(window.speechSynthesis.getVoices());
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const uniqueLangs = Array.from(new Set(availableVoices.map(v => v.lang))).sort();

  const previewVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance("Este é um teste da voz selecionada para seus flashcards.");
    if (ttsVoiceURI) {
      const selectedVoice = availableVoices.find(v => v.voiceURI === ttsVoiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }
    }
    utterance.rate = Number(ttsRate);
    utterance.pitch = Number(ttsPitch);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const [shortcuts, setShortcuts] = useState(
    settings.shortcuts || { showAnswer: ' ', again: '1', hard: '2', good: '3', easy: '4', playTTS: 'p', bury: 'b', suspend: 's', undo: 'z', redo: 'y' }
  );

  const handleShortcutChange = (field: string, val: string) => {
    setShortcuts(prev => ({ ...prev, [field]: val }));
  };

  useEffect(() => {
    updateSettings({
      theme: theme as any,
      language: language as any,
      againMinutes: Number(againMinutes),
      hardMultiplier: Number(hardMultiplier),
      hardMinMinutes: Number(hardMinMinutes),
      goodMultiplier: Number(goodMultiplier),
      easyMultiplier: Number(easyMultiplier),
      newAgainMinutes: Number(newAgainMinutes),
      newHardMinutes: Number(newHardMinutes),
      newGoodMinutes: Number(newGoodMinutes),
      newEasyMinutes: Number(newEasyMinutes),
      cardsPerBlock: Number(cardsPerBlock),
      cardOrder: cardOrder as any,
      ttsVoiceURI,
      ttsRate: Number(ttsRate),
      ttsPitch: Number(ttsPitch),
      shortcuts
    });
  }, [theme, language, againMinutes, hardMultiplier, hardMinMinutes, goodMultiplier, easyMultiplier, newAgainMinutes, newHardMinutes, newGoodMinutes, newEasyMinutes, cardsPerBlock, cardOrder, ttsVoiceURI, ttsRate, ttsPitch, shortcuts]);

  const handleExportProfile = async () => {
    const state = useStore.getState();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cardblocks_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        importProfile(json);
        alert("Perfil e dados importados com sucesso!");
      } catch (err) {
        alert("Erro ao ler o arquivo JSON.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate({ type: 'home' })}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Configurações do Estudo
        </h2>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6 shadow-xs">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">
          Preferências Gerais & Blocos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Cartões por Bloco</label>
            <input 
              type="number" 
              min="1" 
              max="100"
              value={cardsPerBlock}
              onChange={(e) => setCardsPerBlock(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Quantidade de cartões agrupados por rodada de estudo.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Ordem dos Cartões</label>
            <select 
              value={cardOrder}
              onChange={(e) => setCardOrder(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="newFirst">Novos Primeiro</option>
              <option value="reviewsFirst">Revisões Primeiro</option>
              <option value="random">Aleatório</option>
            </select>
          </div>
        </div>
      </div>

      {/* TTS Settings */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Leitura por Voz (TTS)</h3>
            <p className="text-xs text-gray-500">Configure a síntese de voz para áudio dos cartões.</p>
          </div>
          <button 
            type="button"
            onClick={previewVoice}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-blue-500 transition-colors shadow-xs"
          >
            Ouvir Teste
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Voz</label>
            <select 
              value={ttsVoiceURI}
              onChange={(e) => setTtsVoiceURI(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Voz Padrão do Sistema</option>
              {availableVoices.map(v => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Velocidade ({ttsRate}x)</label>
            <input 
              type="range" min="0.5" max="2" step="0.1"
              value={ttsRate}
              onChange={(e) => setTtsRate(Number(e.target.value))}
              className="w-full accent-blue-600 mt-2"
            />
          </div>
        </div>
      </div>

      {/* SM-2 Intervals */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6 shadow-xs">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">
          Algoritmo SM-2 & Repetição Espaçada
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Novo: Errei (min)</label>
            <input type="number" min="1" value={newAgainMinutes} onChange={(e) => setNewAgainMinutes(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Novo: Difícil (min)</label>
            <input type="number" min="1" value={newHardMinutes} onChange={(e) => setNewHardMinutes(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Novo: Bom (min)</label>
            <input type="number" min="1" value={newGoodMinutes} onChange={(e) => setNewGoodMinutes(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Novo: Fácil (min)</label>
            <input type="number" min="1" value={newEasyMinutes} onChange={(e) => setNewEasyMinutes(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm" />
          </div>
        </div>
      </div>

      {/* Backup & Data */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6 shadow-xs">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">
          Backup & Exportação
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={handleExportProfile}
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-2 transition-colors text-sm font-semibold"
          >
            <Download className="w-4 h-4 text-blue-600" />
            Exportar Perfil Completo (.json)
          </button>
          
          <div className="flex-1 relative">
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportProfile}
              ref={fileInputRef}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-2 transition-colors text-sm font-semibold pointer-events-none">
              <Upload className="w-4 h-4 text-emerald-600" />
              Restaurar Backup (.json)
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-3">
          <button 
            onClick={() => { if (confirm("Restaurar configurações padrão?")) resetSettings(); }}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
