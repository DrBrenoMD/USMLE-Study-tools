import React, { useState, useEffect } from 'react';
import { X, Save, ArrowRightLeft } from 'lucide-react';
import { STEP1_EXAMS, STEP2_EXAMS, getStep1PassProb } from '../utils/scoreCalculator';

type AddScoreModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (score: any) => void;
};

export function AddScoreModal({ isOpen, onClose, onSave }: AddScoreModalProps) {
  const [step, setStep] = useState<'Step 1' | 'Step 2'>('Step 1');
  const [selectedExamId, setSelectedExamId] = useState<string>(STEP1_EXAMS[0].id);
  const [inputMode, setInputMode] = useState<'percent' | 'incorrects'>('percent');
  const [inputValue, setInputValue] = useState<string>('0');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen) {
      setStep('Step 1');
      setSelectedExamId(STEP1_EXAMS[0].id);
      setInputMode('percent');
      setInputValue('0');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedExamId(step === 'Step 1' ? STEP1_EXAMS[0].id : STEP2_EXAMS[0].id);
    setInputValue('0');
  }, [step]);

  if (!isOpen) return null;

  const exams = step === 'Step 1' ? STEP1_EXAMS : STEP2_EXAMS;
  const currentExam = exams.find(e => e.id === selectedExamId) || exams[0];
  const parsedValue = parseFloat(inputValue) || 0;

  let incorrects = 0;
  let percentCorrect = 0;

  if (inputMode === 'incorrects') {
    incorrects = Math.max(0, Math.min(parsedValue, currentExam.totalQuestions));
    percentCorrect = ((currentExam.totalQuestions - incorrects) / currentExam.totalQuestions) * 100;
  } else {
    percentCorrect = Math.max(0, Math.min(parsedValue, 100));
    incorrects = Math.round(currentExam.totalQuestions * (1 - (percentCorrect / 100)));
  }

  const rawEstimatedScore = currentExam.calculate(incorrects, percentCorrect, currentExam.difficulty);
  const estimatedScore = Math.min(300, Math.max(1, Math.round(rawEstimatedScore)));

  const passProbability = step === 'Step 1' ? getStep1PassProb(percentCorrect) : undefined;

  const handleSave = () => {
    onSave({
      date: new Date(date).toISOString(),
      examName: currentExam.name,
      step,
      totalQuestions: currentExam.totalQuestions,
      incorrects,
      percentCorrect,
      estimatedScore,
      passProbability
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">Adicionar Simulado</h3>
          <button onClick={onClose} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-5">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button 
              onClick={() => setStep('Step 1')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${step === 'Step 1' ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
            >
              Step 1
            </button>
            <button 
              onClick={() => setStep('Step 2')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${step === 'Step 2' ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
            >
              Step 2 CK
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Data do Simulado</label>
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Exame</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
            >
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>{exam.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {inputMode === 'incorrects' ? 'Número de Erros' : 'Porcentagem de Acertos (%)'}
              </label>
              <button 
                onClick={() => {
                  setInputMode(prev => prev === 'incorrects' ? 'percent' : 'incorrects');
                  setInputValue('0');
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-200 transition-colors bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"
              >
                <ArrowRightLeft className="w-3 h-3" />
                Mudar
              </button>
            </div>
            <input 
              type="number" 
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              step={inputMode === 'percent' ? "0.1" : "1"}
              className="px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-xl font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
            />
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl flex items-center justify-between border border-blue-100">
            <div className="text-sm font-medium text-blue-900">Resultado Estimado:</div>
            <div className="text-right">
              {step === 'Step 1' ? (
                <>
                  {percentCorrect < 55 ? (
                    <div className="text-lg font-black text-red-600 uppercase">LOW PASS</div>
                  ) : (
                    <div className="text-lg font-black text-blue-700 dark:text-blue-300">{passProbability?.toFixed(1)}% Pass</div>
                  )}
                </>
              ) : (
                <div className="text-lg font-black text-emerald-700">{estimatedScore}</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:bg-gray-800/50 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
