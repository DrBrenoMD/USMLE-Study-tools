import React, { useState, useEffect, useRef } from 'react';
import { useStore, Question } from '../store/useStore';
import { X, Save, Sparkles, PlusCircle, ChevronDown, ChevronUp, Copy, Image as ImageIcon, Trash2, Clipboard } from 'lucide-react';
import { RichEditor } from './RichEditor';

// Helper para verificar se texto ou HTML possui conteúdo real preenchido pelo usuário (ignora tags vazias como <p></p> e espaços)
export function hasMeaningfulContent(htmlOrText: string): boolean {
  if (!htmlOrText) return false;
  if (/<img|<audio|<video/i.test(htmlOrText)) return true;
  const text = htmlOrText
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0;
}

// Helper para deduplicar tags e garantir que q-* e qbank-sync nunca se repitam
export function deduplicateTags(rawTags: string | string[], newQId?: string): string[] {
  const list = Array.isArray(rawTags)
    ? rawTags
    : (rawTags || '').split(',').map(t => t.trim()).filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of list) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    // Se um novo questionId for informado, descarta tags antigas q-* que não sejam da questão atual
    if (newQId && trimmed.startsWith('q-') && trimmed.toLowerCase() !== `q-${newQId}`.toLowerCase()) {
      continue;
    }

    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }

  // Garante a tag q-${newQId} uma única vez se houver newQId
  if (newQId && newQId.trim()) {
    const qTag = `q-${newQId.trim()}`;
    if (!seen.has(qTag.toLowerCase())) {
      seen.add(qTag.toLowerCase());
      result.unshift(qTag);
    }
  }

  // Garante a tag qbank-sync uma única vez
  if ((newQId || seen.has('qbank-sync')) && !seen.has('qbank-sync')) {
    result.push('qbank-sync');
  }

  return result;
}

export function deduplicateTagsString(rawTags: string | string[], newQId?: string): string {
  return deduplicateTags(rawTags, newQId).join(', ');
}

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
  const { decks, cards, createDeck, createCard, updateCard } = useStore();
  const [deckId, setDeckId] = useState<string>('');
  const [front, setFront] = useState(initialData?.front || '');
  const [back, setBack] = useState(initialData?.back || '');
  const [tags, setTags] = useState<string>(
    deduplicateTagsString(initialData?.tags || sourceQuestion?.tags || [], initialData?.questionId || sourceQuestion?.id)
  );

  const [currentCardId, setCurrentCardId] = useState<string | null>(initialData?.id || null);

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
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'info' | 'error', text: string } | null>(null);

  // Refs para manter valores atualizados em listeners de eventos assíncronos
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const currentStateRef = useRef({
    front,
    back,
    tags,
    deckId,
    questionId,
    questionStem,
    questionChoices,
    explanation,
    educationalObjective,
    questionImages,
    cardId: currentCardId,
  });

  useEffect(() => {
    currentStateRef.current = {
      front,
      back,
      tags,
      deckId,
      questionId,
      questionStem,
      questionChoices,
      explanation,
      educationalObjective,
      questionImages,
      cardId: currentCardId,
    };
  });

  useEffect(() => {
    if (notificationMsg) {
      const timer = setTimeout(() => setNotificationMsg(null), 3800);
      return () => clearTimeout(timer);
    }
  }, [notificationMsg]);

  useEffect(() => {
    const genDeck = decks.find(d => d.name === "Generated Cards");
    if (genDeck) {
      setDeckId(genDeck.id);
    } else if (decks.length > 0) {
      setDeckId(decks[0].id);
    }
  }, [decks]);

  const getFinalDeckId = () => {
    let finalDeckId = deckId;
    if (!finalDeckId) {
      if (decks.length === 0) {
        finalDeckId = createDeck("Default Deck");
      } else {
        finalDeckId = decks[0].id;
      }
    }
    return finalDeckId;
  };

  const notifyCardSaved = (qId?: string, f?: string, b?: string) => {
    if (!qId) return;
    const payload = { questionId: qId, front: f, back: b };
    try {
      const bc = new BroadcastChannel('usmle_flashcards_sync');
      bc.postMessage({ type: 'USMLE_FLASHCARD_SAVED', payload });
      setTimeout(() => bc.close(), 1000);
    } catch (e) {}
    if (typeof window !== 'undefined' && window.opener) {
      try {
        window.opener.postMessage({ type: 'USMLE_FLASHCARD_SAVED', payload }, '*');
      } catch (e) {}
    }
  };

  // Processa nova questão recebida (navegação automática ou manual):
  // Salva o card anterior SE frente e verso foram preenchidos manualmente; caso contrário, descarta o card incompleto!
  const handleIncomingQuestion = (payload: any) => {
    if (!payload) return;
    const incomingQId = (payload.questionId || '').trim();
    const incomingStem = (payload.questionStem || payload.stem || '').trim();

    const prev = currentStateRef.current;
    const hadPrevQuestion = Boolean(prev.questionId || prev.questionStem);
    const isDifferentQuestion = incomingQId 
      ? incomingQId !== prev.questionId 
      : (incomingStem && incomingStem !== prev.questionStem);

    // Se estiver navegando para uma questão diferente:
    if (hadPrevQuestion && isDifferentQuestion) {
      const userCompleted = hasMeaningfulContent(prev.front) && hasMeaningfulContent(prev.back);
      if (userCompleted) {
        // Usuário preencheu manualmente frente e verso: SALVA O FLASHCARD!
        const targetDeckId = getFinalDeckId();
        if (targetDeckId) {
          const cleanTags = deduplicateTags(prev.tags, prev.questionId);
          if (prev.cardId) {
            updateCard(prev.cardId, {
              deckId: targetDeckId,
              front: prev.front,
              back: prev.back,
              tags: cleanTags,
              questionId: prev.questionId.trim() || undefined,
              questionStem: prev.questionStem.trim() || undefined,
              questionChoices: prev.questionChoices.trim() || undefined,
              explanation: prev.explanation.trim() || undefined,
              educationalObjective: prev.educationalObjective.trim() || undefined,
              questionImages: prev.questionImages.length > 0 ? prev.questionImages : undefined,
            });
          } else {
            createCard({
              deckId: targetDeckId,
              front: prev.front,
              back: prev.back,
              tags: cleanTags,
              questionId: prev.questionId.trim() || undefined,
              questionStem: prev.questionStem.trim() || undefined,
              questionChoices: prev.questionChoices.trim() || undefined,
              explanation: prev.explanation.trim() || undefined,
              educationalObjective: prev.educationalObjective.trim() || undefined,
              questionImages: prev.questionImages.length > 0 ? prev.questionImages : undefined,
            });
          }
          notifyCardSaved(prev.questionId, prev.front, prev.back);
          setNotificationMsg({
            type: 'success',
            text: `Card da questão ${prev.questionId || ''} salvo com sucesso!`
          });
        }
      } else {
        // NÃO completou frente e verso: DESCARTE O FLASHCARD INCOMPLETO!
        setNotificationMsg({
          type: 'info',
          text: `Questão ${prev.questionId || 'anterior'} descartada (frente e verso não foram preenchidos).`
        });
      }
    }

    // Carrega a nova questão
    // Verifica se já existia um card salvo para esta questão no banco de cartões
    const existing = cardsRef.current.find(c => 
      (incomingQId && c.questionId === incomingQId) || 
      (incomingQId && c.tags?.some(t => t.toLowerCase() === `q-${incomingQId}`.toLowerCase()))
    );

    if (existing) {
      setFront(existing.front || '');
      setBack(existing.back || '');
      setCurrentCardId(existing.id);
      setTags(deduplicateTagsString(existing.tags || [], incomingQId));
    } else {
      setFront('');
      setBack('');
      setCurrentCardId(null);
      setTags(deduplicateTagsString(payload.tags || [], incomingQId));
    }

    setQuestionId(incomingQId);
    setQuestionStem(incomingStem);
    setQuestionChoices(payload.questionChoices || payload.choices || '');
    setExplanation(payload.explanation || '');
    setEducationalObjective(payload.educationalObjective || payload.objective || '');
    const imgs = Array.isArray(payload.questionImages || payload.images)
      ? (payload.questionImages || payload.images)
      : [];
    setQuestionImages(imgs);

    setIsQBankFieldsOpen(true);
  };

  // Integration listener: Allows Chrome Extension or parent window to send question data directly
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'USMLE_GENERATE_FLASHCARD' || event.data.action === 'create_card_from_question') {
        const payload = event.data.payload || event.data.data || event.data;
        handleIncomingQuestion(payload);
      }
    };

    const handleCustomEvent = (e: any) => {
      const payload = e.detail;
      if (payload) handleIncomingQuestion(payload);
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('usmle_generate_flashcard' as any, handleCustomEvent);

    // BroadcastChannel sync across tabs and windows
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('usmle_flashcards_sync');
        channel.onmessage = (event) => {
          if (!event.data) return;
          if (event.data.type === 'USMLE_GENERATE_FLASHCARD' || event.data.action === 'create_card_from_question') {
            const payload = event.data.payload || event.data.data || event.data;
            handleIncomingQuestion(payload);
          }
        };
      } catch (e) {}
    }

    // Handshake with window.opener if opened from Q-Bank extension
    if (typeof window !== 'undefined' && window.opener) {
      try {
        window.opener.postMessage({ type: 'USMLE_FLASHCARD_TAB_READY' }, '*');
      } catch (e) {}
    }

    // Suporte a colar imagens (Ctrl+V) de qualquer lugar no modal
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
              if (uploadEvent.target?.result) {
                setQuestionImages(prev => [...prev, uploadEvent.target!.result as string]);
                setIsQBankFieldsOpen(true);
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);

    // Also check URL parameters if user opened with query params
    const params = new URLSearchParams(window.location.search);
    const qid = params.get('import_qid');
    const stem = params.get('import_stem');
    const obj = params.get('import_obj');
    if (qid || stem || obj) {
      handleIncomingQuestion({
        questionId: qid || '',
        questionStem: stem || '',
        educationalObjective: obj || '',
        tags: qid ? [`q-${qid}`, 'qbank-sync'] : ['qbank-sync']
      });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('usmle_generate_flashcard' as any, handleCustomEvent);
      window.removeEventListener('paste', handleGlobalPaste);
      if (channel) channel.close();
    };
  }, []);

  const handleCreate = () => {
    const targetDeckId = getFinalDeckId();
    if (!targetDeckId) {
      setNotificationMsg({ type: 'error', text: 'Por favor, selecione um baralho.' });
      return;
    }

    if (!hasMeaningfulContent(front) || !hasMeaningfulContent(back)) {
      setNotificationMsg({
        type: 'error',
        text: 'Preencha manualmente a frente e o verso do flashcard para salvar.'
      });
      return;
    }
    
    const tagArray = deduplicateTags(tags, questionId);
    
    if (currentCardId) {
      updateCard(currentCardId, {
        deckId: targetDeckId,
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
        deckId: targetDeckId,
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

    notifyCardSaved(questionId, front, back);
    
    setFront('');
    setBack('');
    setCurrentCardId(null);
    setQuestionId('');
    setQuestionStem('');
    setQuestionChoices('');
    setExplanation('');
    setEducationalObjective('');
    setQuestionImages([]);
    setTags('');
    setIsQBankFieldsOpen(false);
    setNotificationMsg({ type: 'success', text: 'Cartão salvo com sucesso!' });
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

  const handleImagePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            if (uploadEvent.target?.result) {
              setQuestionImages(prev => [...prev, uploadEvent.target!.result as string]);
            }
          };
          reader.readAsDataURL(file);
        }
      } else if (item.type === 'text/plain') {
        item.getAsString(text => {
          if (text && (text.startsWith('http://') || text.startsWith('https://')) && (/\.(jpe?g|png|gif|webp|svg)/i.test(text) || text.includes('image') || text.includes('media') || text.includes('cloudfront') || text.includes('uworld') || text.includes('amboss'))) {
            setQuestionImages(prev => [...prev, text.trim()]);
          }
        });
      }
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          if (uploadEvent.target?.result) {
            setQuestionImages(prev => [...prev, uploadEvent.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
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
          {notificationMsg && (
            <div className={`p-3.5 rounded-xl text-xs font-semibold animate-in fade-in flex items-center justify-between gap-2 shadow-sm ${
              notificationMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : notificationMsg.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            }`}>
              <div className="flex items-center gap-2">
                <span>{notificationMsg.type === 'success' ? '✅' : notificationMsg.type === 'error' ? '⚠️' : 'ℹ️'}</span>
                <span>{notificationMsg.text}</span>
              </div>
              <button 
                onClick={() => setNotificationMsg(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
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
                Frente (Pergunta ou Prompt) *
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
                Verso (Resposta) *
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Tags (separadas por vírgula)
              </label>
              <span className="text-[11px] text-gray-400 font-normal">
                Sem duplicações de qid ou qbank-sync
              </span>
            </div>
            <input 
              type="text" 
              value={tags}
              onChange={e => setTags(e.target.value)}
              onBlur={() => setTags(prev => deduplicateTagsString(prev, questionId))}
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
                    <span>Imagens da Questão (Explicação / Links / Anexos)</span>
                    <span className="text-[11px] text-gray-400 font-normal">Aceita Ctrl+V, Links e Upload</span>
                  </label>
                  
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newImageUrl}
                      onChange={e => setNewImageUrl(e.target.value)}
                      placeholder="Cole link da imagem ou da explicação..."
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

                  {/* Área interativa para Colar (Ctrl+V) ou Arrastar imagens */}
                  <div
                    onPaste={handleImagePaste}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleImageDrop}
                    tabIndex={0}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 focus:border-blue-500 focus:outline-none rounded-xl p-3 text-center transition-colors cursor-pointer bg-gray-50/50 dark:bg-gray-800/40"
                  >
                    <div className="flex flex-col items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                        <Clipboard className="w-4 h-4" />
                        <span>Clique aqui e cole imagens (Ctrl+V) ou arraste imagens</span>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        Recebe capturas de tela, imagens copiadas da explicação ou links da questão
                      </span>
                    </div>
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
            {(!hasMeaningfulContent(front) || !hasMeaningfulContent(back)) && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium hidden md:inline">
                ⚠️ Preencha a frente e o verso para salvar
              </span>
            )}
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
              disabled={(!deckId && decks.length > 0) || !hasMeaningfulContent(front) || !hasMeaningfulContent(back)}
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
