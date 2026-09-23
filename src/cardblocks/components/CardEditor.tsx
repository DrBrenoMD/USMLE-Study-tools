import React, { useState } from 'react';
import { Flashcard, useStore } from '../store/useStore';
import { RichEditor } from './RichEditor';
import { renderCardText } from '../lib/utils';
import { Eye, EyeOff, Tag as TagIcon, Flag, X, ChevronDown, ChevronUp, Image as ImageIcon, Trash2 } from 'lucide-react';

export const CardEditor: React.FC<{ 
  card: Flashcard;
  onUpdate?: (id: string, f: string, b: string, d?: string, tags?: string[], flag?: string) => void;
}> = ({ card, onUpdate }) => {
  const { updateCard } = useStore();
  const [showPreview, setShowPreview] = useState(false);
  const [f, setF] = useState(card.front);
  const [b, setB] = useState(card.back);
  const [d, setD] = useState(card.details || '');
  const [tagInput, setTagInput] = useState('');

  // QBank Integration fields (natively collapsed by default)
  const [isQBankOpen, setIsQBankOpen] = useState(false);
  const [questionId, setQuestionId] = useState(card.questionId || '');
  const [subject, setSubject] = useState(card.subject || card.subjective || '');
  const [system, setSystem] = useState(card.system || '');
  const [questionStem, setQuestionStem] = useState(card.questionStem || '');
  const [questionChoices, setQuestionChoices] = useState(card.questionChoices || '');
  const [explanation, setExplanation] = useState(card.explanation || '');
  const [educationalObjective, setEducationalObjective] = useState(card.educationalObjective || '');
  const [questionImages, setQuestionImages] = useState<string[]>(card.questionImages || []);
  const [newImageUrl, setNewImageUrl] = useState('');

  const FLAGS = [
    { value: '', label: 'None', color: 'bg-gray-300 dark:bg-gray-600' },
    { value: 'red', label: 'Red', color: 'bg-red-500' },
    { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
    { value: 'green', label: 'Green', color: 'bg-emerald-500' },
    { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
    { value: 'purple', label: 'Purple', color: 'bg-purple-500' },
  ];

  const handleCommitUpdates = (overrides?: Partial<Flashcard>) => {
    const finalData = {
      front: f,
      back: b,
      details: d,
      tags: card.tags,
      flag: card.flag,
      questionId: questionId.trim() || undefined,
      subject: subject.trim() || undefined,
      system: system.trim() || undefined,
      questionStem: questionStem.trim() || undefined,
      questionChoices: questionChoices.trim() || undefined,
      explanation: explanation.trim() || undefined,
      educationalObjective: educationalObjective.trim() || undefined,
      questionImages: questionImages.length > 0 ? questionImages : undefined,
      ...overrides
    };

    updateCard(card.id, finalData);
    if (onUpdate) {
      onUpdate(card.id, finalData.front, finalData.back, finalData.details, finalData.tags, finalData.flag);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      const currentTags = card.tags || [];
      if (!currentTags.includes(newTag)) {
        const nextTags = [...currentTags, newTag];
        handleCommitUpdates({ tags: nextTags });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = card.tags || [];
    const nextTags = currentTags.filter(t => t !== tagToRemove);
    handleCommitUpdates({ tags: nextTags });
  };

  const handleFlagChange = (flagValue: string) => {
    handleCommitUpdates({ flag: flagValue || undefined });
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    const nextImgs = [...questionImages, newImageUrl.trim()];
    setQuestionImages(nextImgs);
    setNewImageUrl('');
    handleCommitUpdates({ questionImages: nextImgs });
  };

  const handleRemoveImage = (index: number) => {
    const nextImgs = questionImages.filter((_, i) => i !== index);
    setQuestionImages(nextImgs);
    handleCommitUpdates({ questionImages: nextImgs });
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const nextImgs = [...questionImages, reader.result as string];
        setQuestionImages(nextImgs);
        handleCommitUpdates({ questionImages: nextImgs });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;
    const items = clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            const nextImgs = [...questionImages, reader.result as string];
            setQuestionImages(nextImgs);
            handleCommitUpdates({ questionImages: nextImgs });
          }
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 text-gray-900 dark:text-gray-100">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50 dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-2.5 w-full sm:w-auto">
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <TagIcon className="w-4 h-4 text-gray-400" />
            {(card.tags || []).map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 text-xs font-semibold">
                {tag}
                <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-rose-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input 
              type="text" 
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Tag + Enter..." 
              className="bg-transparent border-none text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-0 w-28"
            />
          </div>
          
          {/* Flag */}
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1.5">
              {FLAGS.map(flag => (
                <button
                  key={flag.value || 'none'}
                  type="button"
                  onClick={() => handleFlagChange(flag.value)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${flag.color} ${(card.flag || '') === flag.value ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  title={flag.label}
                />
              ))}
            </div>
          </div>
        </div>

        <button 
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-650 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors"
        >
          {showPreview ? <><EyeOff className="w-3.5 h-3.5" /> Edição</> : <><Eye className="w-3.5 h-3.5" /> Prévia</>}
        </button>
      </div>

      {/* Main Fields */}
      <div className="space-y-4">
        <div>
          <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Frente</div>
          {showPreview ? (
            <div 
              className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl min-h-[60px] text-gray-900 dark:text-gray-100 text-sm"
              dangerouslySetInnerHTML={{ __html: renderCardText(f) || '<span class="text-gray-400">Vazio</span>' }}
            />
          ) : (
            <RichEditor 
              value={f} 
              onChange={(val) => { 
                setF(val); 
                handleCommitUpdates({ front: val }); 
              }} 
            />
          )}
        </div>

        <div>
          <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Verso</div>
          {showPreview ? (
            <div 
              className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl min-h-[60px] text-gray-900 dark:text-gray-100 text-sm"
              dangerouslySetInnerHTML={{ __html: renderCardText(b) || '<span class="text-gray-400">Vazio</span>' }}
            />
          ) : (
            <RichEditor 
              value={b} 
              onChange={(val) => { 
                setB(val); 
                handleCommitUpdates({ back: val }); 
              }} 
            />
          )}
        </div>

        <div>
          <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Detalhes Extras</div>
          {showPreview ? (
            <div 
              className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl min-h-[60px] text-gray-900 dark:text-gray-100 text-sm"
              dangerouslySetInnerHTML={{ __html: renderCardText(d) || '<span class="text-gray-400">Vazio</span>' }}
            />
          ) : (
            <RichEditor 
              value={d} 
              onChange={(val) => { 
                setD(val); 
                handleCommitUpdates({ details: val }); 
              }} 
            />
          )}
        </div>

        {/* QBank Integration Collapsible Section (Natively collapsed by default) */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50/70 dark:bg-gray-800/40">
          <button
            type="button"
            onClick={() => setIsQBankOpen(!isQBankOpen)}
            className="w-full px-4 py-3 text-left font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between transition-colors cursor-pointer bg-gray-100/60 dark:bg-gray-800/80"
          >
            <span className="flex items-center gap-2">
              <span>📋 Dados da Questão / Integração QBank (Opcional)</span>
              {questionId && (
                <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 text-[11px] font-mono normal-case">
                  ID: {questionId}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span>{isQBankOpen ? 'Ocultar' : 'Expandir'}</span>
              {isQBankOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {isQBankOpen && (
            <div className="p-4 space-y-3.5 border-t border-gray-200 dark:border-gray-700 text-sm animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Question Id
                  </label>
                  <input
                    type="text"
                    value={questionId}
                    onChange={e => {
                      setQuestionId(e.target.value);
                      handleCommitUpdates({ questionId: e.target.value });
                    }}
                    placeholder="Ex: UW-1024, AMBOSS-4581"
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Subject (Matéria / Área)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => {
                      setSubject(e.target.value);
                      handleCommitUpdates({ subject: e.target.value });
                    }}
                    placeholder="Ex: Pathology, Pharmacology"
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    System (Sistema)
                  </label>
                  <input
                    type="text"
                    value={system}
                    onChange={e => {
                      setSystem(e.target.value);
                      handleCommitUpdates({ system: e.target.value });
                    }}
                    placeholder="Ex: Cardiovascular System, Renal"
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Enunciado (Stem)
                </label>
                <textarea
                  rows={3}
                  value={questionStem}
                  onChange={e => {
                    setQuestionStem(e.target.value);
                    handleCommitUpdates({ questionStem: e.target.value });
                  }}
                  placeholder="Enunciado completo da questão..."
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Alternativas
                </label>
                <textarea
                  rows={2}
                  value={questionChoices}
                  onChange={e => {
                    setQuestionChoices(e.target.value);
                    handleCommitUpdates({ questionChoices: e.target.value });
                  }}
                  placeholder="A) ...&#10;B) ..."
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Explicação
                </label>
                <textarea
                  rows={3}
                  value={explanation}
                  onChange={e => {
                    setExplanation(e.target.value);
                    handleCommitUpdates({ explanation: e.target.value });
                  }}
                  placeholder="Explicação da questão..."
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Educational Objective
                </label>
                <textarea
                  rows={2}
                  value={educationalObjective}
                  onChange={e => {
                    setEducationalObjective(e.target.value);
                    handleCommitUpdates({ educationalObjective: e.target.value });
                  }}
                  placeholder="Objetivo educacional..."
                  className="w-full bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20 rounded-xl p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Imagens da Questão
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={e => setNewImageUrl(e.target.value)}
                    placeholder="URL da imagem (https://...)"
                    className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddImage(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="px-2.5 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-xs font-semibold"
                  >
                    Adicionar
                  </button>
                  <label className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageFileUpload} />
                  </label>
                </div>

                {/* Paste Area for Images */}
                <div
                  onPaste={handlePasteImage}
                  tabIndex={0}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 rounded-xl p-2.5 text-center bg-gray-50/50 dark:bg-gray-800/40 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    📋 Cole imagens com <kbd className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[10px] text-gray-800 dark:text-gray-200">Ctrl+V</kbd> diretamente aqui
                  </p>
                </div>

                {questionImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
                    {questionImages.map((img, idx) => (
                      <div key={idx} className="relative group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden w-16 h-16 bg-gray-100 dark:bg-gray-800">
                        <img src={img} alt={`Anexo ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-0.5 right-0.5 p-1 bg-rose-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
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
    </div>
  );
};
