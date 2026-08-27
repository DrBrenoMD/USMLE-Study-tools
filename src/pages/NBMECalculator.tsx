import React, { useState, useEffect } from 'react';
import { Calculator, Save, AlertCircle, FileEdit, ArrowRightLeft } from 'lucide-react';
import { useScores } from '../hooks/useScores';
import { MouseInteractiveBackground } from '../components/MouseInteractiveBackground';
import { STEP1_EXAMS, STEP2_EXAMS, getStep1PassProb } from '../utils/scoreCalculator';

export default function NBMECalculator() {
  const [step, setStep] = useState<'Step 1' | 'Step 2'>('Step 1');
  const [selectedExamId, setSelectedExamId] = useState<string>(STEP1_EXAMS[0].id);
  
  const [inputMode, setInputMode] = useState<'incorrects' | 'percent'>('percent');
  const [inputValue, setInputValue] = useState<string>('0');
  
  const { addScore } = useScores();
  const [savedMessage, setSavedMessage] = useState('');

  // Update selected exam when step changes
  useEffect(() => {
    setSelectedExamId(step === 'Step 1' ? STEP1_EXAMS[0].id : STEP2_EXAMS[0].id);
    setInputValue('0'); // Reset input on step change
  }, [step]);

  const exams = step === 'Step 1' ? STEP1_EXAMS : STEP2_EXAMS;
  const currentExam = exams.find(e => e.id === selectedExamId) || exams[0];

  const parsedValue = parseFloat(inputValue) || 0;
  
  // Calculate incorrects and percent based on input mode
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
  
  const passProbability = step === 'Step 1' 
    ? getStep1PassProb(percentCorrect)
    : undefined;

  const handleSave = () => {
    addScore({
      date: new Date().toISOString(),
      examName: currentExam.name,
      step,
      totalQuestions: currentExam.totalQuestions,
      incorrects,
      percentCorrect,
      estimatedScore,
      passProbability
    });
    setSavedMessage('Score salvo com sucesso no Preditor!');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  const getScoreColor = () => {
    if (step === 'Step 1') {
      if (estimatedScore >= 210) return 'text-emerald-600';
      if (estimatedScore >= 196) return 'text-blue-600';
      return 'text-amber-600';
    } else {
      if (estimatedScore >= 240) return 'text-emerald-600';
      if (estimatedScore >= 220) return 'text-blue-600';
      return 'text-amber-600';
    }
  };

  return (
    <div className="relative flex flex-1 flex-col items-center py-10 px-6 font-sans">
      <MouseInteractiveBackground />
      <div className="z-10 w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-blue-600 px-6 py-5 flex items-center gap-3 text-white">
          <Calculator className="w-6 h-6" />
          <h2 className="text-xl font-bold">Calculadora de Score NBME / UWSA</h2>
        </div>
        
        <div className="p-6 flex flex-col gap-6">
          {/* Abas */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setStep('Step 1')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${step === 'Step 1' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Step 1
            </button>
            <button 
              onClick={() => setStep('Step 2')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${step === 'Step 2' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Step 2 CK
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700">Selecione o Exame</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {exams.map(exam => (
                  <option key={exam.id} value={exam.id}>{exam.name} ({exam.totalQuestions} questões)</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                  {inputMode === 'incorrects' ? 'Número de Erros (Incorrects)' : 'Porcentagem de Acertos (%)'}
                </label>
                <button 
                  onClick={() => {
                    setInputMode(prev => prev === 'incorrects' ? 'percent' : 'incorrects');
                    setInputValue('0');
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-2 py-1 rounded"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  Mudar para {inputMode === 'incorrects' ? '%' : 'Erros'}
                </button>
              </div>
              <input 
                type="number" 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                step={inputMode === 'percent' ? "0.1" : "1"}
                className="px-3 py-3 border border-gray-300 rounded-lg text-2xl font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
              <div className="text-center text-xs font-medium text-gray-500 mt-1">
                {inputMode === 'incorrects' 
                  ? `Equivale a ${percentCorrect.toFixed(1)}% de acertos` 
                  : `Equivale a aproximadamente ${incorrects} erros`}
              </div>
            </div>
          </div>

          {/* Resultado */}
          <div className="mt-4 p-6 bg-gray-50 border border-gray-200 rounded-xl flex flex-col items-center justify-center text-center gap-2">
            
            <div className={`text-6xl font-black ${getScoreColor()}`}>
              {estimatedScore}
            </div>
            <div className="text-sm font-bold text-gray-700">
              Score Estimado (3 Dígitos)
            </div>
            <div className="text-xs font-semibold text-gray-500 mt-1 bg-white px-3 py-1 rounded-full border border-gray-200">
              Range de Score: {estimatedScore - currentExam.margin} a {estimatedScore + currentExam.margin}
            </div>
            
            {step === 'Step 1' && passProbability !== undefined && (
              <div className="mt-4 pt-4 border-t border-gray-200 w-full flex flex-col items-center">
                {percentCorrect < 55 ? (
                  <div className="text-3xl font-black text-red-600 uppercase">
                    LOW PASS
                  </div>
                ) : (
                  <>
                    <div className={`text-3xl font-black ${passProbability >= 95 ? 'text-emerald-600' : passProbability >= 80 ? 'text-blue-600' : 'text-amber-600'}`}>
                      {passProbability.toFixed(1)}%
                    </div>
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mt-1">
                      Chance estimada de aprovação (Pass)
                    </div>
                  </>
                )}
              </div>
            )}
            
            <div className="flex items-start gap-2 mt-6 text-[10px] text-gray-400 bg-white p-3 rounded-lg border border-gray-100 text-left w-full">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                As estimativas de score são baseadas em regressões de dados comunitários coletados no Reddit (r/Step1, r/Step2) e aproximações matemáticas para formulários offline. 
                Os resultados oficiais podem variar.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 mt-2">
            <button 
              onClick={handleSave}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              Salvar no Preditor de Scores
            </button>
            {savedMessage && (
              <span className="text-emerald-600 text-sm font-semibold flex items-center gap-1.5 animate-in fade-in duration-300">
                <FileEdit className="w-4 h-4" /> {savedMessage}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
