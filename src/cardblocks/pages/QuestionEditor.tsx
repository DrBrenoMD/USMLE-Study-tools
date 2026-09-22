import React, { useState } from 'react';
import { useStore, QuestionAlternative } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Save } from 'lucide-react';
import { RichEditor } from '../components/RichEditor';

export const QuestionEditor: React.FC<{
  questionId?: string;
  bankId?: string;
  onNavigate: (p: Page) => void;
}> = ({ questionId, bankId, onNavigate }) => {
  const { questions, questionBanks, createQuestion, updateQuestion } = useStore();
  const existing = questions.find(q => q.id === questionId);

  const [targetBankId, setTargetBankId] = useState(bankId || existing?.bankId || questionBanks[0]?.id || '');
  const [text, setText] = useState(existing?.text || '');
  const [subject, setSubject] = useState(existing?.subject || '');
  const [topic, setTopic] = useState(existing?.topic || '');
  const [explanation, setExplanation] = useState(existing?.explanation || '');
  const [alternatives, setAlternatives] = useState<QuestionAlternative[]>(
    existing?.alternatives || [
      { id: '1', text: '', isCorrect: true, explanation: '' },
      { id: '2', text: '', isCorrect: false, explanation: '' },
      { id: '3', text: '', isCorrect: false, explanation: '' },
      { id: '4', text: '', isCorrect: false, explanation: '' },
      { id: '5', text: '', isCorrect: false, explanation: '' },
    ]
  );

  const handleSetCorrect = (index: number) => {
    setAlternatives(prev =>
      prev.map((alt, i) => ({
        ...alt,
        isCorrect: i === index
      }))
    );
  };

  const handleAltText = (index: number, val: string) => {
    setAlternatives(prev =>
      prev.map((alt, i) => (i === index ? { ...alt, text: val } : alt))
    );
  };

  const handleSave = () => {
    if (!text.trim()) {
      alert("Digite o enunciado da questão.");
      return;
    }
    if (!targetBankId) {
      alert("Selecione um banco de questões.");
      return;
    }

    if (existing) {
      updateQuestion(existing.id, {
        bankId: targetBankId,
        text,
        subject,
        topic,
        explanation,
        alternatives,
      });
    } else {
      createQuestion({
        bankId: targetBankId,
        text,
        subject,
        topic,
        explanation,
        alternatives,
      });
    }

    onNavigate({ type: 'bank', bankId: targetBankId });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(targetBankId ? { type: 'bank', bankId: targetBankId } : { type: 'banks' })}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {existing ? 'Editar Questão' : 'Nova Questão'}
          </h2>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          Salvar Questão
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Banco de Questões</label>
            <select
              value={targetBankId}
              onChange={(e) => setTargetBankId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
            >
              {questionBanks.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Matéria (Subject)</label>
            <input
              type="text"
              placeholder="ex: Cardiologia, Farmacologia"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tópico (Topic)</label>
            <input
              type="text"
              placeholder="ex: Insuficiência Cardíaca"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Enunciado da Questão</label>
          <RichEditor value={text} onChange={setText} placeholder="Digite o enunciado da questão..." />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Alternativas</h3>
        <div className="space-y-3">
          {alternatives.map((alt, i) => (
            <div
              key={alt.id || i}
              className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                alt.isCorrect
                  ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40'
              }`}
            >
              <button
                type="button"
                onClick={() => handleSetCorrect(i)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                  alt.isCorrect
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
                }`}
                title={alt.isCorrect ? 'Alternativa Correta' : 'Marcar como Correta'}
              >
                {String.fromCharCode(65 + i)}
              </button>
              <input
                type="text"
                placeholder={`Alternativa ${String.fromCharCode(65 + i)}...`}
                value={alt.text}
                onChange={(e) => handleAltText(i, e.target.value)}
                className="flex-1 bg-transparent border-0 text-sm text-gray-900 dark:text-white focus:outline-none"
              />
              {alt.isCorrect && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Correta
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-xs space-y-2">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Explicação e Gabarito Comentado</label>
        <RichEditor value={explanation} onChange={setExplanation} placeholder="Explique o motivo do gabarito e comente as alternativas incorretas..." />
      </div>
    </div>
  );
};
