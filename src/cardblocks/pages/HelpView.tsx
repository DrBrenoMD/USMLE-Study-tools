import React from 'react';
import { Page } from '../App';
import { ArrowLeft, HelpCircle, Keyboard, BookOpen, Clock, Sparkles } from 'lucide-react';

export const HelpView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate({ type: 'home' })}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Guia de Uso & Atalhos de Teclado
          </h2>
          <p className="text-xs text-gray-500">Aprenda a tirar o máximo proveito do Cardblocks integrado ao USMLE Study Tools.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shortcuts */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Atalhos na Sessão de Estudo
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-400">Mostrar Resposta</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[11px]">Espaço</kbd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-400">Avaliação: Errei (Again)</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[11px]">1</kbd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-400">Avaliação: Difícil (Hard)</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[11px]">2</kbd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-400">Avaliação: Bom (Good)</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[11px]">3</kbd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-400">Avaliação: Fácil (Easy)</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[11px]">4</kbd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-400">Ouvir com Leitor TTS</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[11px]">P</kbd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-400">Suspender Cartão</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[11px]">S</kbd>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-gray-600 dark:text-gray-400">Enterrar (Bury) Cartão</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[11px]">B</kbd>
            </div>
          </div>
        </div>

        {/* SM-2 Info */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Como Funciona o Algoritmo SM-2
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            O algoritmo SuperMemo-2 calcula intervalos de repetição exponencial com base na sua facilidade de resposta:
          </p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-4">
            <li><b>Errei (1):</b> O cartão é reagendado em curto prazo (minutos) e o fator de facilidade cai.</li>
            <li><b>Difícil (2):</b> Intervalo aumenta ligeiramente, com decréscimo suave na facilidade.</li>
            <li><b>Bom (3):</b> Avança para o próximo estágio multiplicador padrão do algoritmo.</li>
            <li><b>Fácil (4):</b> Intervalo expande consideravelmente para retenção duradoura sem sobrecarga.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
