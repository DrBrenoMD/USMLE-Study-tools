import React, { useState, useEffect } from 'react';
import { useStore, Question } from '../store/useStore';
import { X, Save, Sparkles, PlusCircle, ChevronDown, ChevronUp, Copy, Image as ImageIcon, Trash2 } from 'lucide-react';
import { RichEditor } from './RichEditor';

export const CardCreationModal: React.FC<{ 
  onClose: () => void;
  sourceQuestion?: Question;
  initialData?: {
    id?: string;
    questionId?: string;
    questionStem?: string;
    questionChoices?: string;
    explanation?: string;
    educationalObjective?: string;
    questionImages?: string[];
    front?: string;
    back?: string;
    tags?: string[];
  };
}> = ({ onClose, sourceQuestion, initialData }) => {
  const { decks, createDeck, createCard, updateCard } = useStore();
  const [deckId, setDeckId] = useState<string>('');
  const [front, setFront] = useState(initialData?.front || '');
  const [back, setBack] = useState(initialData?.back || '');
  const [tags, setTags] = useState<string>(initialData?.tags?.join(', ') || sourceQuestion?.tags?.join(', ') || '');

  // QBank integration fields (natively collapsed by default unless imported)
  const [isQBankFieldsOpen, setIsQBankFieldsOpen] = useState(
    Boolean(initialData?.questionId || initialData?.questionStem || initialData?.educationalObjective)
  );
  const [questionId, setQuestionId] = useState(initialData?.questionId || sourceQuestion?.id || '');
  const [questionStem, setQuestionStem] = useState(initialData?.questionStem || sourceQuestion?.text || '');
  const [questionChoices, setQuestionChoices] = useState(
    initialData?.questionChoices || 
    (sourceQuestion?.alternatives ? sourceQuestion.alternatives.map(a => `${a.letter || ''}) ${a.text}`).join('\n') : '')
  );
  const [explanation, setExplanation] = useState(initialData?.explanation || sourceQuestion?.explanation || '');
  const [educationalObjective, setEducationalObjective] = useState(initialData?.educationalObjective || '');
  const [questionImages, setQuestionImages] = useState<string[]>(initialData?.questionImages || []);
  const [newImageUrl, setNewImageUrl] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<{front: string, back: string}[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  useEffect(() => {
    const genDeck = decks.find(d => d.name === "Generated Cards");
    if (genDeck) {
      setDeckId(genDeck.id);
    } else if (decks.length > 0) {
      setDeckId(decks[0].id);
    }
  }, [decks]);

  // Integration listener: Allows Chrome Extension or parent window to send question data directly
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'USMLE_GENERATE_FLASHCARD' || event.data.action === 'create_card_from_question') {
        const payload = event.data.payload || event.data.data || event.data;
        if (payload.questionId) setQuestionId(payload.questionId);
        if (payload.questionStem || payload.stem) {
          const stem = payload.questionStem || payload.stem;
          setQuestionStem(stem);
          if (!front) setFront(`<p>${stem}</p>`);
        }
        if (payload.questionChoices || payload.choices) setQuestionChoices(payload.questionChoices || payload.choices);
        if (payload.explanation) {
          setExplanation(payload.explanation);
          if (!back && !payload.educationalObjective) setBack(`<p>${payload.explanation}</p>`);
        }
        if (payload.educationalObjective || payload.objective) {
          const obj = payload.educationalObjective || payload.objective;
          setEducationalObjective(obj);
          if (!back) setBack(`<p><b>Educational Objective:</b></p><p>${obj}</p>`);
        }
        if (payload.questionImages || payload.images) {
          const imgs = Array.isArray(payload.questionImages || payload.images) ? (payload.questionImages || payload.images) : [];
          setQuestionImages(imgs);
        }
        if (payload.tags && Array.isArray(payload.tags)) {
          setTags(prev => prev ? `${prev}, ${payload.tags.join(', ')}` : payload.tags.join(', '));
        }
        setIsQBankFieldsOpen(true);
      }
    };

    const handleCustomEvent = (e: any) => {
      const payload = e.detail;
      if (!payload) return;
      if (payload.questionId) setQuestionId(payload.questionId);
      if (payload.questionStem) {
        setQuestionStem(payload.questionStem);
        if (!front) setFront(`<p>${payload.questionStem}</p>`);
      }
      if (payload.questionChoices) setQuestionChoices(payload.questionChoices);
      if (payload.explanation) setExplanation(payload.explanation);
      if (payload.educationalObjective) {
        setEducationalObjective(payload.educationalObjective);
        if (!back) setBack(`<p><b>Educational Objective:</b></p><p>${payload.educationalObjective}</p>`);
      }
      if (payload.questionImages) setQuestionImages(payload.questionImages);
      setIsQBankFieldsOpen(true);
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('usmle_generate_flashcard' as any, handleCustomEvent);

    // BroadcastChannel sync across tabs and windows
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('usmle_flashcards_sync');
      channel.onmessage = (event) => {
        if (!event.data) return;
        if (event.data.type === 'USMLE_GENERATE_FLASHCARD' || event.data.action === 'create_card_from_question') {
          const payload = event.data.payload || event.data.data || event.data;
          if (payload.questionId) setQuestionId(payload.questionId);
          if (payload.questionStem || payload.stem) {
            const stem = payload.questionStem || payload.stem;
            setQuestionStem(stem);
            setFront(`<p>${stem}</p>`);
          }
          if (payload.questionChoices || payload.choices) setQuestionChoices(payload.questionChoices || payload.choices);
          if (payload.explanation) setExplanation(payload.explanation);
          if (payload.educationalObjective || payload.objective) {
            const obj = payload.educationalObjective || payload.objective;
            setEducationalObjective(obj);
            setBack(`<p><b>Educational Objective:</b></p><p>${obj}</p>`);
          }
          if (payload.questionImages || payload.images) {
            const imgs = Array.isArray(payload.questionImages || payload.images) ? (payload.questionImages || payload.images) : [];
            setQuestionImages(imgs);
          }
          setIsQBankFieldsOpen(true);
        }
      };
    }

    // Handshake with window.opener if opened from Q-Bank extension
    if (typeof window !== 'undefined' && window.opener) {
      try {
        window.opener.postMessage({ type: 'USMLE_FLASHCARD_TAB_READY' }, '*');
      } catch (e) {}
    }

    // Also check URL parameters if user opened with query params
    const params = new URLSearchParams(window.location.search);
    const qid = params.get('import_qid');
    const stem = params.get('import_stem');
    const obj = params.get('import_obj');
    if (qid || stem || obj) {
      if (qid) setQuestionId(qid);
      if (stem) {
        setQuestionStem(stem);
        if (!front) setFront(`<p>${stem}</p>`);
      }
      if (obj) {
        setEducationalObjective(obj);
        if (!back) setBack(`<p><b>Educational Objective:</b></p><p>${obj}</p>`);
      }
      setIsQBankFieldsOpen(true);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('usmle_generate_flashcard' as any, handleCustomEvent);
      if (channel) channel.close();
    };
  }, [front, back]);

  const getFinalDeckId = () => {
    let finalDeckId = deckId;
    if (!finalDeckId) {
      if (decks.length === 0) {
        finalDeckId = createDeck("Default Deck");
      } else {
        return null;
      }
    }
    return finalDeckId;
  };

  const handleCreate = () => {
    const finalDeckId = getFinalDeckId();
    if (!finalDeckId) return;
    
    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    
    if (initialData?.id) {
      updateCard(initialData.id, {
        deckId: finalDeckId,
        front,
        back,
        tags: tagArray,
        questionId: questionId.trim() || undefined,
        questionStem: questionStem.trim() || undefined,
        questionChoices: questionChoices.trim() || undefined,
        explanation: explanation.trim() || undefined,
        educationalObjective: educationalObjective.trim() || undefined,
        questionImages: questionImages.length > 0 ? questionImages : undefined,
      });
    } else {
      createCard({
        deckId: finalDeckId,
        front,
        back,
        tags: tagArray,
        sourceQuestionId: sourceQuestion?.id,
        questionId: questionId.trim() || undefined,
        questionStem: questionStem.trim() || undefined,
        questionChoices: questionChoices.trim() || undefined,
        explanation: explanation.trim() || undefined,
        educationalObjective: educationalObjective.trim() || undefined,
        questionImages: questionImages.length > 0 ? questionImages : undefined,
      });
    }
    
    setFront('');
    setBack('');
    setQuestionId('');
    setQuestionStem('');
    setQuestionChoices('');
    setExplanation('');
    setEducationalObjective('');
    setQuestionImages([]);
    setIsQBankFieldsOpen(false);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setQuestionImages(prev => [...prev, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setQuestionImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setQuestionImages(prev => [...prev, reader.result as string]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyStemToFront = () => {
    if (!questionStem) return;
    setFront(`<p>${questionStem}</p>`);
  };

  const handleApplyObjectiveToBack = () => {
    const content = educationalObjective 
      ? `<p><b>Educational Objective:</b></p><p>${educationalObjective}</p>`
      : explanation ? `<p><b>Explicação:</b></p><p>${explanation}</p>` : '';
    if (content) {
      setBack(prev => prev ? `${prev}<br/>${content}` : content);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] overflow-hidden text-gray-900 dark:text-gray-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Criar Novo Flashcard</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Adicione perguntas, respostas e integre dados de questões de QBanks.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold animate-in fade-in">
              Cartão salvo com sucesso! Você pode continuar adicionando outros cartões.
            </div>
          )}

          {/* Deck Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Baralho de Destino</label>
            <select 
              value={deckId} 
              onChange={e => setDeckId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="" disabled>Selecione um baralho...</option>
              {decks.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Front (Question) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Frente (Pergunta ou Prompt)
              </label>
              {questionStem && (
                <button
                  type="button"
                  onClick={handleApplyStemToFront}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Copy className="w-3 h-3" />
                  <span>Usar Enunciado da Questão</span>
                </button>
              )}
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <RichEditor value={front} onChange={setFront} placeholder="Ex: Qual o achado clínico característico... {{c1::cloze}}" />
            </div>
          </div>

          {/* Back (Answer) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Verso (Resposta)
              </label>
              {(educationalObjective || explanation) && (
                <button
                  type="button"
                  onClick={handleApplyObjectiveToBack}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Copy className="w-3 h-3" />
                  <span>Usar Educational Objective / Explicação</span>
                </button>
              )}
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <RichEditor value={back} onChange={setBack} placeholder="Resposta e síntese do conceito..." />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Tags (separadas por vírgula)
            </label>
            <input 
              type="text" 
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ex: cardio, step1, uworld, high-yield"
            />
          </div>

          {/* QBank Integration Collapsible Section (Natively collapsed by default) */}
          <div className="border border-gray-200 dark:border-gray-700/80 rounded-2xl overflow-hidden bg-gray-50/70 dark:bg-gray-800/40 transition-all">
            <button
              type="button"
              onClick={() => setIsQBankFieldsOpen(!isQBankFieldsOpen)}
              className="w-full px-4 py-3 text-left font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors cursor-pointer bg-gray-100/60 dark:bg-gray-800/80"
            >
              <span className="flex items-center gap-2">
                <span>📋 Dados da Questão / Integração QBank (Opcional)</span>
                {questionId && (
                  <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 text-[11px] font-mono normal-case">
                    ID: {questionId}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span>{isQBankFieldsOpen ? 'Ocultar' : 'Expandir'}</span>
                {isQBankFieldsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>
            
            {isQBankFieldsOpen && (
              <div className="p-4 sm:p-5 space-y-4 border-t border-gray-200 dark:border-gray-700/80 text-sm animate-in fade-in duration-100">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Estes campos armazenam a questão original e são integrados automaticamente com a extensão de navegador e bancos de questões. Ficam nativamente colapsados para não poluir os cards.
                </p>

                {/* 1. Question ID */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Question Id
                  </label>
                  <input
                    type="text"
                    value={questionId}
                    onChange={e => setQuestionId(e.target.value)}
                    placeholder="Ex: UW-1024, AMBOSS-4581, NBME-28"
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 2. Enunciado */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Enunciado (Stem da Questão)
                  </label>
                  <textarea
                    rows={3}
                    value={questionStem}
                    onChange={e => setQuestionStem(e.target.value)}
                    placeholder="Texto completo do caso clínico ou pergunta do QBank..."
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 3. Alternativas */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Alternativas
                  </label>
                  <textarea
                    rows={2}
                    value={questionChoices}
                    onChange={e => setQuestionChoices(e.target.value)}
                    placeholder="A) Opção 1&#10;B) Opção 2&#10;C) Opção 3..."
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                  />
                </div>

                {/* 4. Explicação */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Explicação Completa
                  </label>
                  <textarea
                    rows={3}
                    value={explanation}
                    onChange={e => setExplanation(e.target.value)}
                    placeholder="Explicação detalhada da resposta correta e dos distratores..."
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 5. Educational Objective */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Educational Objective (Objetivo Educacional)
                  </label>
                  <textarea
                    rows={2}
                    value={educationalObjective}
                    onChange={e => setEducationalObjective(e.target.value)}
                    placeholder="Take-home message ou objetivo educacional da questão..."
                    className="w-full bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20 rounded-xl p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                {/* 6. Imagens da Questão */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                    <span>Imagens da Questão</span>
                    <span className="text-[11px] text-gray-400 font-normal">URLs ou arquivos locais</span>
                  </label>
                  
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newImageUrl}
                      onChange={e => setNewImageUrl(e.target.value)}
                      placeholder="Cole o link direto da imagem (https://...)"
                      className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddImage(); } }}
                    />
                    <button
                      type="button"
                      onClick={handleAddImage}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Adicionar URL
                    </button>
                    <label className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageFileUpload} />
                    </label>
                  </div>

                  {questionImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
                      {questionImages.map((img, idx) => (
                        <div key={idx} className="relative group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden w-20 h-20 bg-gray-100 dark:bg-gray-800">
                          <img src={img} alt={`Anexo ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Remover imagem"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center shrink-0 bg-gray-50/50 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            O flashcard será salvo no baralho selecionado com suporte a Anki.
          </p>
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button 
              type="button"
              onClick={handleCreate}
              disabled={(!deckId && decks.length > 0) || !front.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm shadow-blue-500/20 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Cartão</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
