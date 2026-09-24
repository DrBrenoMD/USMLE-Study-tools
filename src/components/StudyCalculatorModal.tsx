import React, { useState } from 'react';
import { X, Calculator, RotateCcw, Equal } from 'lucide-react';

interface StudyCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudyCalculatorModal: React.FC<StudyCalculatorModalProps> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [mode, setMode] = useState<'standard' | 'formulas'>('standard');

  // Fórmulas Clínicas
  const [na, setNa] = useState('');
  const [cl, setCl] = useState('');
  const [hco3, setHco3] = useState('');
  const anionGap = (Number(na) || 0) - ((Number(cl) || 0) + (Number(hco3) || 0));

  const [glucose, setGlucose] = useState('');
  const [bun, setBun] = useState('');
  const effectiveOsm = (2 * (Number(na) || 0)) + ((Number(glucose) || 0) / 18);
  const totalOsm = effectiveOsm + ((Number(bun) || 0) / 2.8);

  if (!isOpen) return null;

  const handleDigit = (d: string) => {
    setDisplay(prev => (prev === '0' || prev === 'Error') ? d : prev + d);
  };

  const handleOp = (op: string) => {
    setDisplay(prev => prev + ' ' + op + ' ');
  };

  const handleClear = () => {
    setDisplay('0');
  };

  const handleCalculate = () => {
    try {
      const sanitized = display.replace(/×/g, '*').replace(/÷/g, '/');
      // eslint-disable-next-line no-eval
      const result = Function(`'use strict'; return (${sanitized})`)();
      setDisplay(String(Number(result.toFixed(4))));
    } catch (e) {
      setDisplay('Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Calculadora Clínica</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="p-2 border-b border-gray-100 dark:border-gray-800 flex gap-1 bg-gray-50/50 dark:bg-gray-800/30">
          <button
            onClick={() => setMode('standard')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'standard' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Padrão
          </button>
          <button
            onClick={() => setMode('formulas')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'formulas' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Fórmulas USMLE
          </button>
        </div>

        {/* Content */}
        {mode === 'standard' ? (
          <div className="p-4 space-y-3">
            <div className="bg-gray-900 text-right p-3 rounded-xl border border-gray-800 font-mono text-2xl text-white overflow-x-auto min-h-[52px] flex items-center justify-end">
              {display}
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-sm font-semibold">
              <button onClick={handleClear} className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors">C</button>
              <button onClick={() => setDisplay(prev => prev.slice(0, -1) || '0')} className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">⌫</button>
              <button onClick={() => handleOp('÷')} className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">÷</button>
              <button onClick={() => handleOp('×')} className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">×</button>

              <button onClick={() => handleDigit('7')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">7</button>
              <button onClick={() => handleDigit('8')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">8</button>
              <button onClick={() => handleDigit('9')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">9</button>
              <button onClick={() => handleOp('-')} className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">-</button>

              <button onClick={() => handleDigit('4')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">4</button>
              <button onClick={() => handleDigit('5')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">5</button>
              <button onClick={() => handleDigit('6')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">6</button>
              <button onClick={() => handleOp('+')} className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">+</button>

              <button onClick={() => handleDigit('1')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">1</button>
              <button onClick={() => handleDigit('2')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">2</button>
              <button onClick={() => handleDigit('3')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">3</button>
              <button onClick={handleCalculate} className="row-span-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xs">
                <Equal className="w-5 h-5" />
              </button>

              <button onClick={() => handleDigit('0')} className="col-span-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">0</button>
              <button onClick={() => handleDigit('.')} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100">.</button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto text-xs">
            {/* Anion Gap */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
              <div className="font-bold text-gray-900 dark:text-white flex items-center justify-between">
                <span>Anion Gap Sérico</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold text-sm">
                  {anionGap > 0 ? anionGap.toFixed(1) : '--'} mEq/L
                </span>
              </div>
              <div className="text-[10px] text-gray-500">Na⁺ - (Cl⁻ + HCO₃⁻) [Normal: 8-12]</div>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="number"
                  placeholder="Na⁺"
                  value={na}
                  onChange={(e) => setNa(e.target.value)}
                  className="p-1.5 bg-white dark:bg-gray-800 border rounded-lg text-center font-mono"
                />
                <input
                  type="number"
                  placeholder="Cl⁻"
                  value={cl}
                  onChange={(e) => setCl(e.target.value)}
                  className="p-1.5 bg-white dark:bg-gray-800 border rounded-lg text-center font-mono"
                />
                <input
                  type="number"
                  placeholder="HCO₃⁻"
                  value={hco3}
                  onChange={(e) => setHco3(e.target.value)}
                  className="p-1.5 bg-white dark:bg-gray-800 border rounded-lg text-center font-mono"
                />
              </div>
            </div>

            {/* Osmolalidade */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
              <div className="font-bold text-gray-900 dark:text-white flex items-center justify-between">
                <span>Osmolalidade Calculada</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  {totalOsm > 0 ? totalOsm.toFixed(1) : '--'} mOsm/kg
                </span>
              </div>
              <div className="text-[10px] text-gray-500">2×Na⁺ + Glicose/18 + BUN/2.8 [Normal: 275-295]</div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  placeholder="Glicose (mg/dL)"
                  value={glucose}
                  onChange={(e) => setGlucose(e.target.value)}
                  className="p-1.5 bg-white dark:bg-gray-800 border rounded-lg text-center font-mono"
                />
                <input
                  type="number"
                  placeholder="BUN (mg/dL)"
                  value={bun}
                  onChange={(e) => setBun(e.target.value)}
                  className="p-1.5 bg-white dark:bg-gray-800 border rounded-lg text-center font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
