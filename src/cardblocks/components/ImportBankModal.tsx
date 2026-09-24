import React, { useState } from 'react';
import { useStore, QuestionAlternative } from '../store/useStore';
import { X, Upload, FileJson, AlertCircle } from 'lucide-react';

export const ImportBankModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { createQuestion, questionBanks, createQuestionBank } = useStore();
  const [jsonText, setJsonText] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleImport = () => {
    setError('');
    setSuccess('');
    
    let targetBankId = selectedBankId;
    if (selectedBankId === 'new') {
      if (!newBankName.trim()) {
        setError('Please enter a name for the new question bank.');
        return;
      }
      targetBankId = createQuestionBank(newBankName.trim());
    } else if (!targetBankId) {
      setError('Please select or create a question bank.');
      return;
    }

    if (!jsonText.trim()) {
      setError('Please paste your JSON data.');
      return;
    }

    try {
      const data = JSON.parse(jsonText);
      if (!Array.isArray(data)) {
        throw new Error('Data must be an array of questions.');
      }

      let importedCount = 0;

      for (const item of data) {
        if (!item.text || !Array.isArray(item.alternatives)) {
          throw new Error('Invalid format: Each question must have "text" and an "alternatives" array.');
        }

        const newAlternatives: QuestionAlternative[] = item.alternatives.map((alt: any) => ({
          id: crypto.randomUUID(),
          letter: typeof alt.letter === 'string' ? alt.letter : '?',
          text: alt.text || '',
          isCorrect: !!alt.isCorrect
        }));

        createQuestion({
          bankId: targetBankId,
          qid: String(item.qid || item.id || `Q-${importedCount + 1}`),
          subject: item.subject || '',
          specialty: item.specialty || '',
          area: item.area || '',
          topic: item.topic || '',
          subTopic: item.subTopic || '',
          subArea: item.subArea || '',
          tags: Array.isArray(item.tags) ? item.tags : [],
          text: item.text,
          alternatives: newAlternatives,
          explanation: item.explanation || ''
        });

        importedCount++;
      }

      setSuccess(`Successfully imported ${importedCount} questions!`);
      setJsonText('');
      
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Invalid JSON format.');
    }
  };

  const handleDownloadExample = () => {
    const exampleData = [
      {
        "text": "<p>Qual é a capital do <b>Brasil</b>?</p><img src=\"https://example.com/map.jpg\" alt=\"Mapa\" />",
        "subject": "Geografia",
        "specialty": "Geopolítica",
        "area": "Capitais",
        "topic": "América do Sul",
        "subTopic": "Brasil Imperial",
        "subArea": "Brasil",
        "tags": ["geografia", "brasil", "fácil"],
        "explanation": "<p><b>Brasília</b>, inaugurada em <i>1960</i>, é a capital federal do Brasil podendo conter imagens <img src=\"https://example.com/img2.jpg\"/>.</p>",
        "alternatives": [
          { "letter": "A", "text": "Rio de Janeiro", "isCorrect": false },
          { "letter": "B", "text": "São Paulo", "isCorrect": false },
          { "letter": "C", "text": "Brasília", "isCorrect": true },
          { "letter": "D", "text": "Salvador", "isCorrect": false }
        ]
      },
      {
        "text": "<p>Quem pintou o quadro <i>Monalisa</i>?</p>",
        "subject": "História da Arte",
        "specialty": "Artes Plásticas",
        "area": "Renascimento",
        "topic": "Pintura",
        "subTopic": "Século XVI",
        "subArea": "Pintores",
        "tags": ["arte", "história", "média"],
        "explanation": "<p>Leonardo da Vinci foi um importante pintor do Renascimento, famoso por obras como a Monalisa.</p>",
        "alternatives": [
          { "letter": "A", "text": "Michelangelo", "isCorrect": false },
          { "letter": "B", "text": "Leonardo da Vinci", "isCorrect": true },
          { "letter": "C", "text": "Vincent van Gogh", "isCorrect": false },
          { "letter": "D", "text": "Pablo Picasso", "isCorrect": false }
        ]
      },
      {
        "text": "<p>Qual é a fórmula química da água?</p>",
        "subject": "Química",
        "area": "Compostos",
        "subArea": "Inorgânica",
        "tags": ["química", "água", "fácil"],
        "explanation": "<p>A molécula de água é composta por dois átomos de hidrogênio e um de oxigênio (<b>H2O</b>).</p>",
        "alternatives": [
          { "letter": "A", "text": "H2O2", "isCorrect": false },
          { "letter": "B", "text": "CO2", "isCorrect": false },
          { "letter": "C", "text": "H2O", "isCorrect": true },
          { "letter": "D", "text": "NaCl", "isCorrect": false }
        ]
      },
      {
        "text": "<p>Qual é o resultado de <code>8 x 7</code>?</p>",
        "subject": "Matemática",
        "area": "Aritmética",
        "subArea": "Multiplicação",
        "tags": ["matemática", "cálculo", "fácil"],
        "explanation": "<p>Pela tabuada, sabemos que 8 vezes 7 é igual a <b>56</b>.</p>",
        "alternatives": [
          { "letter": "A", "text": "54", "isCorrect": false },
          { "letter": "B", "text": "56", "isCorrect": true },
          { "letter": "C", "text": "58", "isCorrect": false },
          { "letter": "D", "text": "64", "isCorrect": false }
        ]
      },
      {
        "text": "<p>Qual planeta é conhecido como o Planeta Vermelho?</p>",
        "subject": "Ciências",
        "area": "Astronomia",
        "subArea": "Sistema Solar",
        "tags": ["ciências", "espaço", "planetas"],
        "explanation": "<p><b>Marte</b> é chamado de Planeta Vermelho devido à abundância de óxido de ferro em sua superfície.</p>",
        "alternatives": [
          { "letter": "A", "text": "Marte", "isCorrect": true },
          { "letter": "B", "text": "Júpiter", "isCorrect": false },
          { "letter": "C", "text": "Vênus", "isCorrect": false },
          { "letter": "D", "text": "Saturno", "isCorrect": false }
        ]
      }
    ];

    const blob = new Blob([JSON.stringify(exampleData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'example_questions.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-ui-background border border-ui-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-ui-border shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Import Questions
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-ui-surface rounded-full text-ui-muted hover:text-ui-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
           <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm text-ui-text flex gap-3 items-start relative">
             <FileJson className="w-5 h-5 text-primary shrink-0 mt-0.5" />
             <div className="flex-1 pr-24">
               <p className="font-semibold mb-1 opacity-90">Paste your JSON data below.</p>
               <p className="opacity-70 mb-2">
                 The JSON should be an array of question objects containing <code>text</code>, <code>alternatives</code> (which is an array of objects having <code>letter, text, isCorrect</code>), and optional properties like <code>subject, specialty, area, topic, subTopic, subArea, tags, explanation</code>.
               </p>
               <p className="opacity-70">
                 <b>Note:</b> You can use full HTML inside <code>text</code> and <code>explanation</code> properties to include images, videos, tables, and rich text formatting.
               </p>
             </div>
             <button
               onClick={handleDownloadExample}
               className="absolute top-4 right-4 text-xs font-semibold px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors"
             >
               Download Example
             </button>
           </div>

           <div>
              <label className="block text-sm font-semibold text-ui-muted mb-2">Select Destination Bank</label>
              <select 
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface-hover border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary transition-colors"
              >
                <option value="" disabled>Choose a bank...</option>
                {questionBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
                <option value="new">+ Create New Bank</option>
              </select>
           </div>

           {selectedBankId === 'new' && (
             <div>
               <label className="block text-sm font-semibold text-ui-muted mb-2">New Bank Name</label>
               <input
                 type="text"
                 value={newBankName}
                 onChange={(e) => setNewBankName(e.target.value)}
                 className="w-full px-3 py-2 bg-ui-surface-hover border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary transition-colors"
                 placeholder="e.g. History Questions"
               />
             </div>
           )}

           {error && (
             <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex gap-2 items-center">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <span className="font-medium">{error}</span>
             </div>
           )}

           {success && (
             <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-lg text-sm flex gap-2 items-center">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <span className="font-medium">{success}</span>
             </div>
           )}

           <div>
             <label className="block text-sm font-semibold text-ui-muted mb-2">JSON Content</label>
             <textarea 
               value={jsonText}
               onChange={(e) => setJsonText(e.target.value)}
               placeholder="[\n  {\n    &quot;text&quot;: &quot;<p>Question text</p>&quot;,\n    &quot;alternatives&quot;: [\n      { &quot;letter&quot;: &quot;A&quot;, &quot;text&quot;: &quot;...&quot;, &quot;isCorrect&quot;: true }\n    ]\n  }\n]"
               className="w-full h-64 bg-ui-surface border border-ui-border rounded-lg p-4 font-mono text-xs text-ui-text focus:outline-none focus:border-primary transition-colors"
             />
           </div>
        </div>

        <div className="p-4 border-t border-ui-border flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-ui-muted font-bold hover:text-ui-text transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleImport}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Import
          </button>
        </div>
      </div>
    </div>
  );
};
