import React, { useState } from 'react';
import { useStore, QuestionAlternative } from '../store/useStore';
import { X, Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ImportBankModal: React.FC<{
  onClose: () => void;
  defaultBankId?: string;
}> = ({ onClose, defaultBankId }) => {
  const { questionBanks, createQuestionBank, upsertQuestionFromQBank } = useStore();
  const [jsonText, setJsonText] = useState('');
  const [selectedBankId, setSelectedBankId] = useState(defaultBankId || questionBanks[0]?.id || '');
  const [newBankName, setNewBankName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Helper para converter alternativas brutas em texto/linhas
  const parseRawChoices = (raw: string): QuestionAlternative[] => {
    if (!raw || typeof raw !== 'string') return [];
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const alts: QuestionAlternative[] = [];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

    lines.forEach((line, idx) => {
      let letter = letters[idx] || String.fromCharCode(65 + idx);
      let text = line;
      const match = line.match(/^([A-H])[\.\)]\s*(.*)$/i);
      if (match) {
        letter = match[1].toUpperCase();
        text = match[2].trim();
      }
      alts.push({
        id: crypto.randomUUID(),
        letter,
        text,
        isCorrect: false,
      });
    });
    return alts;
  };

  const handleImport = () => {
    setError('');
    setSuccess('');
    
    let targetBankId = selectedBankId;
    if (selectedBankId === 'new') {
      if (!newBankName.trim()) {
        setError('Por favor, informe o nome para o novo Banco de Questões.');
        return;
      }
      targetBankId = createQuestionBank(newBankName.trim(), 'Banco criado manualmente');
    } else if (!targetBankId) {
      if (questionBanks.length > 0) {
        targetBankId = questionBanks[0].id;
      } else {
        targetBankId = createQuestionBank('Banco Padrão', 'Banco importado');
      }
    }

    if (!jsonText.trim()) {
      setError('Por favor, cole os dados JSON das questões.');
      return;
    }

    try {
      let rawData: any;
      try {
        rawData = JSON.parse(jsonText);
      } catch (parseErr: any) {
        throw new Error('Formato JSON inválido: ' + parseErr.message);
      }

      // Suporta array direto, objeto com chave 'questions' ou 'data', ou objeto de questão única
      let itemsList: any[] = [];
      if (Array.isArray(rawData)) {
        itemsList = rawData;
      } else if (rawData && Array.isArray(rawData.questions)) {
        itemsList = rawData.questions;
      } else if (rawData && Array.isArray(rawData.data)) {
        itemsList = rawData.data;
      } else if (rawData && typeof rawData === 'object') {
        itemsList = [rawData];
      }

      if (itemsList.length === 0) {
        throw new Error('Nenhuma questão válida encontrada no conteúdo fornecido.');
      }

      let importedCount = 0;

      for (let i = 0; i < itemsList.length; i++) {
        const item = itemsList[i];
        if (!item || typeof item !== 'object') continue;

        const stem = item.stem || item.text || item.questionStem || item.question || '';
        if (!stem && !item.qid && !item.id) continue;

        let alternatives: QuestionAlternative[] = [];

        if (Array.isArray(item.alternatives) && item.alternatives.length > 0) {
          alternatives = item.alternatives.map((alt: any, idx: number) => {
            if (typeof alt === 'string') {
              const match = alt.match(/^([A-H])[\.\)]\s*(.*)$/i);
              return {
                id: crypto.randomUUID(),
                letter: match ? match[1].toUpperCase() : String.fromCharCode(65 + idx),
                text: match ? match[2] : alt,
                isCorrect: false,
              };
            }
            return {
              id: alt.id || crypto.randomUUID(),
              letter: alt.letter || String.fromCharCode(65 + idx),
              text: alt.text || '',
              isCorrect: Boolean(alt.isCorrect),
              explanation: alt.explanation || '',
            };
          });
        } else if (typeof item.questionChoices === 'string') {
          alternatives = parseRawChoices(item.questionChoices);
        } else if (typeof item.choices === 'string') {
          alternatives = parseRawChoices(item.choices);
        } else if (Array.isArray(item.choices)) {
          alternatives = item.choices.map((c: any, idx: number) => ({
            id: crypto.randomUUID(),
            letter: typeof c === 'string' ? String.fromCharCode(65 + idx) : (c.letter || String.fromCharCode(65 + idx)),
            text: typeof c === 'string' ? c : (c.text || ''),
            isCorrect: typeof c === 'object' ? Boolean(c.isCorrect) : false,
          }));
        }

        const explanation = item.explanation || '';
        // Deduz resposta correta caso não marcada
        if (!alternatives.some(a => a.isCorrect) && explanation) {
          const matchAnswer = explanation.match(/(?:correct\s+(?:answer|choice|option)|correta\s+[ée])\s*(?:is\s*)?\(?([A-H])\)?/i);
          if (matchAnswer) {
            const correctLetter = matchAnswer[1].toUpperCase();
            alternatives = alternatives.map(a => ({
              ...a,
              isCorrect: a.letter.toUpperCase() === correctLetter,
            }));
          }
        }

        const qid = String(item.qid || item.questionId || item.id || `Q-${Date.now()}-${i + 1}`);

        upsertQuestionFromQBank({
          qid,
          bankId: targetBankId,
          stem: stem || `Questão ${qid}`,
          text: stem || `Questão ${qid}`,
          alternatives,
          explanation,
          educationalObjective: item.educationalObjective || item.objective || '',
          subject: item.subject || item.specialty || '',
          system: item.system || item.area || '',
          images: item.images || item.questionImages || [],
          links: item.links || [],
          tags: Array.isArray(item.tags) ? item.tags : [`qid:${qid}`],
        });

        importedCount++;
      }

      setSuccess(`Sucesso! ${importedCount} questões importadas/atualizadas com sucesso.`);
      setJsonText('');
      
      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err: any) {
      setError(err.message || 'Erro ao processar arquivo JSON.');
    }
  };

  const handleDownloadExample = () => {
    const exampleData = [
      {
        "qid": "4262",
        "stem": "<p>A 45-year-old male presents with persistent epigastric pain and fatigue. Endoscopy reveals a solitary ulcer in the duodenal bulb. Which of the following is the most likely causative organism?</p>",
        "subject": "Gastroenterology",
        "system": "Gastrointestinal System",
        "educationalObjective": "Helicobacter pylori is the primary cause of duodenal ulcers and is diagnosed via urea breath test or stool antigen.",
        "tags": ["gastroenterology", "usmle-step1", "high-yield"],
        "explanation": "<p><b>Helicobacter pylori</b> colonizes the antral mucosa and decreases somatostatin secretion, leading to hypergastrinemia and duodenal ulceration.</p>",
        "alternatives": [
          { "letter": "A", "text": "Campylobacter jejuni", "isCorrect": false },
          { "letter": "B", "text": "Helicobacter pylori", "isCorrect": true },
          { "letter": "C", "text": "Escherichia coli", "isCorrect": false },
          { "letter": "D", "text": "Clostridioides difficile", "isCorrect": false }
        ]
      },
      {
        "qid": "1894",
        "stem": "<p>A 28-year-old female presents with palpitations, heat intolerance, and weight loss despite increased appetite. Physical exam shows fine tremors and diffusely enlarged thyroid. What is the expected laboratory finding?</p>",
        "subject": "Endocrinology",
        "system": "Endocrine System",
        "educationalObjective": "Graves disease presents with decreased TSH and elevated free T4/T3 due to thyroid-stimulating immunoglobulin.",
        "tags": ["endocrinology", "thyroid"],
        "explanation": "<p>Graves disease is caused by autoantibodies activating the TSH receptor, leading to excessive thyroid hormone synthesis and suppressed TSH.</p>",
        "alternatives": [
          { "letter": "A", "text": "Elevated TSH, decreased free T4", "isCorrect": false },
          { "letter": "B", "text": "Decreased TSH, elevated free T4", "isCorrect": true },
          { "letter": "C", "text": "Elevated TSH, elevated free T4", "isCorrect": false },
          { "letter": "D", "text": "Normal TSH, normal free T4", "isCorrect": false }
        ]
      }
    ];

    const blob = new Blob([JSON.stringify(exampleData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exemplo_questoes_qbank.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Importar Questões
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cole o JSON de questões ou exportação do QBank
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-sm">
           <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-xl p-4 text-xs text-gray-700 dark:text-gray-300 flex flex-col sm:flex-row gap-3 items-start justify-between">
             <div className="flex gap-2.5 items-start flex-1">
               <FileJson className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
               <div className="space-y-1">
                 <p className="font-semibold text-gray-900 dark:text-white">Formatos Suportados:</p>
                 <p className="text-gray-600 dark:text-gray-400">
                   Aceita listas com <code>stem</code>/<code>text</code>, <code>alternatives</code> (ou <code>questionChoices</code>), <code>explanation</code>, <code>qid</code>, <code>subject</code>, <code>system</code> e <code>educationalObjective</code>.
                 </p>
               </div>
             </div>
             <button
               type="button"
               onClick={handleDownloadExample}
               className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 rounded-lg transition-colors cursor-pointer"
             >
               Baixar Exemplo JSON
             </button>
           </div>

           <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Banco de Destino
              </label>
              <select 
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {questionBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
                <option value="new">+ Criar Novo Banco de Questões</option>
              </select>
           </div>

           {selectedBankId === 'new' && (
             <div>
               <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                 Nome do Novo Banco *
               </label>
               <input
                 type="text"
                 value={newBankName}
                 onChange={(e) => setNewBankName(e.target.value)}
                 className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder="Ex: Amboss Step 2 CK, UWorld Step 2..."
               />
             </div>
           )}

           {error && (
             <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 p-3.5 rounded-xl text-xs flex gap-2.5 items-center animate-shake">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <span className="font-semibold">{error}</span>
             </div>
           )}

           {success && (
             <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 p-3.5 rounded-xl text-xs flex gap-2.5 items-center">
               <CheckCircle2 className="w-4 h-4 shrink-0" />
               <span className="font-semibold">{success}</span>
             </div>
           )}

           <div>
             <div className="flex items-center justify-between mb-1.5">
               <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                 Conteúdo JSON
               </label>
             </div>
             <textarea 
               value={jsonText}
               onChange={(e) => setJsonText(e.target.value)}
               placeholder='[
  {
    "qid": "4262",
    "stem": "Question stem text...",
    "alternatives": [
      { "letter": "A", "text": "Option A", "isCorrect": false },
      { "letter": "B", "text": "Option B", "isCorrect": true }
    ],
    "explanation": "Explanation..."
  }
]'
               className="w-full h-56 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 font-mono text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
             />
           </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5 shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleImport}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Importar Questões
          </button>
        </div>
      </div>
    </div>
  );
};
