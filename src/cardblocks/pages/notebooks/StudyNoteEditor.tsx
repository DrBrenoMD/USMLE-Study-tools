import React, { useState, useEffect } from 'react';
import { useStore, StudyNote, Flashcard, Question } from '../../store/useStore';
import { Page } from '../../App';
import {
  ArrowLeft,
  Save,
  Trash2,
  Tag,
  BookOpen,
  Plus,
  Video,
  Mic,
  Code,
  Zap,
  HelpCircle,
  ExternalLink,
  Layers,
  ChevronDown,
  Check,
  Sparkles,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Palette,
  Pin,
  Printer
} from 'lucide-react';
import { RichEditor } from '../../components/RichEditor';
import { AudioVoiceRecorder } from '../../components/AudioVoiceRecorder';
import { VideoEmbedPlayer } from '../../components/VideoEmbedPlayer';
import { CodeSandboxRunner } from '../../components/CodeSandboxRunner';
import { EmbeddedFlashcardBlock } from '../../components/EmbeddedFlashcardBlock';
import { IsolatedHtml } from '../../components/IsolatedHtml';
import { PdfExportModal } from '../../components/PdfExportModal';
import { SafeIsolatedHtmlBlock } from '../../components/SafeIsolatedHtmlBlock';
import { SafeHtmlInsertModal } from '../../components/SafeHtmlInsertModal';
import { sanitizeHtml, renderCardText } from '../../lib/utils';

interface StudyNoteEditorProps {
  noteId: string;
  onNavigate: (page: Page) => void;
  onBack: () => void;
}

const EMOJI_OPTIONS = ['📝', '📚', '💡', '🔬', '🩺', '💊', '❤️', '🧠', '🫁', '🦴', '🧬', '⚡', '🎯', '🧪', '🩹'];
const COLOR_PRESETS = [
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Âmbar', hex: '#f59e0b' },
  { name: 'Roxo', hex: '#8b5cf6' },
  { name: 'Ciano', hex: '#06b6d4' },
  { name: 'Laranja', hex: '#f97316' },
  { name: 'Vermelho', hex: '#ef4444' }
];

export const StudyNoteEditor: React.FC<StudyNoteEditorProps> = ({
  noteId,
  onNavigate,
  onBack
}) => {
  const {
    studyNotes,
    notebookAreas,
    notebookSystems,
    notebookSubjects,
    notebookTopics,
    cards,
    questions,
    updateStudyNote,
    deleteStudyNote,
    createDeck,
    createCard,
    associateQuestionToNote,
    dissociateQuestionFromNote,
    associateCardToNote,
    dissociateCardFromNote,
    createNotebookSystem,
    createNotebookSubject,
    createNotebookTopic
  } = useStore();

  const note = studyNotes.find(n => n.id === noteId);

  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [icon, setIcon] = useState(note?.icon || '📝');
  const [areaId, setAreaId] = useState(note?.areaId || notebookAreas[0]?.id || '');
  const [systemId, setSystemId] = useState(note?.systemId || '');
  const [subjectId, setSubjectId] = useState(note?.subjectId || '');
  const [topicId, setTopicId] = useState(note?.topicId || '');
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isPinned, setIsPinned] = useState(Boolean(note?.isPinned));
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'questions' | 'cards' | 'addQuestion' | 'addCard'>('none');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Mídias
  const [mediaItems, setMediaItems] = useState(note?.mediaItems || []);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [showCodeSandbox, setShowCodeSandbox] = useState(false);
  const [showSafeHtmlModal, setShowSafeHtmlModal] = useState(false);
  const [editingHtmlItem, setEditingHtmlItem] = useState<{ id?: string; title?: string; html?: string; css?: string; js?: string } | null>(null);
  const [previewClozeMode, setPreviewClozeMode] = useState(false);

  // Question / Card Search inside note
  const [searchQuestion, setSearchQuestion] = useState('');
  const [searchCard, setSearchCard] = useState('');

  // Modal para criar novo sistema/matéria/tema inline
  const [newSystemName, setNewSystemName] = useState('');
  const [isAddingSystem, setIsAddingSystem] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setIcon(note.icon || '📝');
      setAreaId(note.areaId);
      setSystemId(note.systemId || '');
      setSubjectId(note.subjectId || '');
      setTopicId(note.topicId || '');
      setTags(note.tags || []);
      setIsPinned(Boolean(note.isPinned));
      setMediaItems(note.mediaItems || []);
    }
  }, [noteId, note]);

  if (!note) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <p className="text-gray-500 dark:text-gray-400">Nota de estudo não encontrada.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
        >
          Voltar ao Caderno
        </button>
      </div>
    );
  }

  const currentArea = notebookAreas.find(a => a.id === areaId);
  const availableSystems = notebookSystems.filter(s => s.areaId === areaId);
  const availableSubjects = notebookSubjects.filter(sub => sub.areaId === areaId && (!sub.systemId || sub.systemId === systemId));
  const availableTopics = notebookTopics.filter(t => t.areaId === areaId && (!t.systemId || t.systemId === systemId) && (!t.subjectId || t.subjectId === subjectId));

  // Questões associadas
  const linkedQuestions = questions.filter(q => 
    note.associatedQuestionIds?.includes(q.id) || (q.qid && note.associatedQuestionIds?.includes(q.qid))
  );

  // Flashcards associados
  const linkedCards = cards.filter(c => 
    note.associatedCardIds?.includes(c.id) || note.embeddedFlashcardIds?.includes(c.id)
  );

  const handleSaveNote = () => {
    updateStudyNote(note.id, {
      title: title.trim() || 'Sem Título',
      content,
      icon,
      areaId,
      systemId: systemId || null,
      subjectId: subjectId || null,
      topicId: topicId || null,
      tags,
      isPinned,
      mediaItems
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, '');
      if (clean && !tags.includes(clean)) {
        const nextTags = [...tags, clean];
        setTags(nextTags);
        updateStudyNote(note.id, { tags: nextTags });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tToRemove: string) => {
    const nextTags = tags.filter(t => t !== tToRemove);
    setTags(nextTags);
    updateStudyNote(note.id, { tags: nextTags });
  };

  const handleCreateSystemInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSystemName.trim() || !areaId) return;
    const sysId = createNotebookSystem(areaId, newSystemName.trim());
    setSystemId(sysId);
    setNewSystemName('');
    setIsAddingSystem(false);
  };

  const handleCreateSubjectInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim() || !areaId) return;
    const subjId = createNotebookSubject(areaId, newSubjectName.trim(), systemId || null);
    setSubjectId(subjId);
    setNewSubjectName('');
    setIsAddingSubject(false);
  };

  const handleCreateTopicInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim() || !areaId) return;
    const topId = createNotebookTopic(areaId, newTopicName.trim(), systemId || null, subjectId || null);
    setTopicId(topId);
    setNewTopicName('');
    setIsAddingTopic(false);
  };

  // Criação de Flashcard rápido a partir desta nota
  const handleCreateCardFromNote = () => {
    const deckName = currentArea ? `Caderno: ${currentArea.name}` : 'Caderno de Estudos';
    let targetDeck = useStore.getState().decks.find(d => d.name === deckName);
    let deckId = targetDeck?.id;
    if (!deckId) {
      deckId = createDeck(deckName, null, false, `Baralho associado à área ${currentArea?.name}`);
    }

    const cardId = createCard(
      deckId,
      `<h4>${title}</h4>`,
      `<div class="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl my-2 border border-blue-200">${content}</div>`,
      `Criado a partir da nota "${title}"`,
      [...(tags || []), 'caderno-nota', currentArea ? currentArea.name.toLowerCase().replace(/\s+/g, '-') : 'area']
    );

    associateCardToNote(note.id, cardId);
    handleSaveNote();
    alert(`⚡ Flashcard criado com sucesso no baralho "${deckName}" e vinculado a esta nota!`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-in fade-in duration-150">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Voltar aos Cadernos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Emoji Icon */}
            <div className="relative group">
              <button
                type="button"
                className="text-2xl p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-transform active:scale-95"
                title="Mudar Ícone"
              >
                {icon}
              </button>
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-2 shadow-xl z-30 hidden group-hover:grid grid-cols-5 gap-1.5 w-48 animate-in fade-in zoom-in-95">
                {EMOJI_OPTIONS.map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setIcon(em);
                      updateStudyNote(note.id, { icon: em });
                    }}
                    className="p-2 text-lg hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-center"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de Área (Obrigatória) */}
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentArea?.color || '#3b82f6' }} />
              <select
                value={areaId}
                onChange={(e) => {
                  setAreaId(e.target.value);
                  setSystemId('');
                  setSubjectId('');
                  setTopicId('');
                }}
                className="bg-transparent border-0 text-gray-900 dark:text-white font-bold text-xs focus:outline-none cursor-pointer pr-1"
              >
                {notebookAreas.map(a => (
                  <option key={a.id} value={a.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Hierarquia: Sistema > Matéria > Tema */}
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
              <span>/</span>
              {/* Sistema */}
              <select
                value={systemId}
                onChange={(e) => {
                  setSystemId(e.target.value);
                  setSubjectId('');
                  setTopicId('');
                }}
                className="bg-transparent border-0 text-gray-600 dark:text-gray-300 text-xs focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-white dark:bg-gray-900">Sistema (Geral)</option>
                {availableSystems.map(s => (
                  <option key={s.id} value={s.id} className="bg-white dark:bg-gray-900">{s.name}</option>
                ))}
              </select>

              <span>/</span>
              {/* Matéria */}
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setTopicId('');
                }}
                className="bg-transparent border-0 text-gray-600 dark:text-gray-300 text-xs focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-white dark:bg-gray-900">Matéria (Geral)</option>
                {availableSubjects.map(sub => (
                  <option key={sub.id} value={sub.id} className="bg-white dark:bg-gray-900">{sub.name}</option>
                ))}
              </select>

              <span>/</span>
              {/* Tema */}
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="bg-transparent border-0 text-gray-600 dark:text-gray-300 text-xs focus:outline-none cursor-pointer max-w-[120px] truncate"
              >
                <option value="" className="bg-white dark:bg-gray-900">Tema (Geral)</option>
                {availableTopics.map(t => (
                  <option key={t.id} value={t.id} className="bg-white dark:bg-gray-900">{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
            title="Exportar esta nota para PDF"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setIsPinned(!isPinned);
              updateStudyNote(note.id, { isPinned: !isPinned });
            }}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isPinned
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={isPinned ? 'Desafixar nota' : 'Fixar nota no topo'}
          >
            <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={() => {
              if (confirm(`Excluir permanentemente a nota "${note.title}"?`)) {
                deleteStudyNote(note.id);
                onBack();
              }
            }}
            className="p-2 text-gray-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            title="Excluir Nota"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleSaveNote}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {savedFeedback ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedFeedback ? 'Salvo!' : 'Salvar Nota'}</span>
          </button>
        </div>
      </div>

      {/* Barra de Associações & Badges com Contadores Numéricos */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Associações:
          </span>

          {/* Badge de Questões Associadas */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'questions' ? 'none' : 'questions')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              linkedQuestions.length > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            <span>🎯</span>
            <span>{linkedQuestions.length} {linkedQuestions.length === 1 ? 'Questão Associada' : 'Questões Associadas'}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Badge de Flashcards Associados */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'cards' ? 'none' : 'cards')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              linkedCards.length > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 shadow-xs'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            <span>⚡</span>
            <span>{linkedCards.length} {linkedCards.length === 1 ? 'Flashcard' : 'Flashcards'}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Ações de Inserção de Mídia e Criação Rápida */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'addQuestion' ? 'none' : 'addQuestion')}
            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Vincular questão a esta nota"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Questão</span>
          </button>

          <button
            onClick={() => setActiveDrawer(activeDrawer === 'addCard' ? 'none' : 'addCard')}
            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Vincular flashcard a esta nota"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Flashcard</span>
          </button>

          <button
            onClick={() => setShowVideoForm(!showVideoForm)}
            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Adicionar vídeo à nota"
          >
            <Video className="w-3.5 h-3.5 text-red-500" />
            <span>+ Vídeo</span>
          </button>

          <button
            onClick={() => setShowAudioRecorder(!showAudioRecorder)}
            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Gravar áudio para a nota"
          >
            <Mic className="w-3.5 h-3.5 text-violet-500" />
            <span>+ Voz</span>
          </button>

          <button
            onClick={() => {
              setEditingHtmlItem(null);
              setShowSafeHtmlModal(true);
            }}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-indigo-200 dark:border-indigo-800"
            title="Inserir bloco de HTML seguro com CSS/JS em iframe isolado"
          >
            <Code className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>+ HTML Seguro</span>
          </button>

          <button
            onClick={() => setPreviewClozeMode(!previewClozeMode)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border ${
              previewClozeMode
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
            }`}
            title="Alternar entre modo edição e modo treino de omissões (clozes)"
          >
            {previewClozeMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{previewClozeMode ? 'Ocultar Clozes Ativo' : 'Testar Clozes'}</span>
          </button>

          <button
            onClick={handleCreateCardFromNote}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
            title="Gerar flashcard a partir desta nota"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gerar Flashcard</span>
          </button>
        </div>
      </div>

      {/* Gaveta de Questões Associadas */}
      {activeDrawer === 'questions' && (
        <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-5 shadow-lg space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>🎯</span>
              <span>Questões Vinculadas a esta Nota ({linkedQuestions.length})</span>
            </h4>
            <button
              onClick={() => setActiveDrawer('none')}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Fechar ✕
            </button>
          </div>

          {linkedQuestions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">Nenhuma questão vinculada a esta nota ainda.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {linkedQuestions.map(q => (
                <div
                  key={q.id}
                  className="p-4 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 rounded-xl space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        QID: {q.qid || q.id}
                      </span>
                      {q.subject && (
                        <span className="text-[11px] text-gray-500">• {q.subject}</span>
                      )}
                    </div>
                    <button
                      onClick={() => dissociateQuestionFromNote(note.id, q.id)}
                      className="text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      Desvincular
                    </button>
                  </div>

                  <div className="text-xs text-gray-900 dark:text-gray-100 font-medium leading-relaxed line-clamp-3">
                    <IsolatedHtml html={q.text || q.stem || ''} />
                  </div>

                  {q.explanation && (
                    <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg text-xs text-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-900/40 line-clamp-2">
                      <b>Explicação:</b> <IsolatedHtml html={q.explanation} />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700/60">
                    <a
                      href={`/questions?qid=${q.qid || q.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-white dark:hover:bg-gray-800 flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Ver no Hub</span>
                    </a>
                    <a
                      href={`/desk?qid=${q.qid || q.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <span>Abrir na Mesa de Estudos ➔</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gaveta de Flashcards Associados */}
      {activeDrawer === 'cards' && (
        <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-5 shadow-lg space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>⚡</span>
              <span>Flashcards Vinculados a esta Nota ({linkedCards.length})</span>
            </h4>
            <button
              onClick={() => setActiveDrawer('none')}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Fechar ✕
            </button>
          </div>

          {linkedCards.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">Nenhum flashcard vinculado a esta nota ainda.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {linkedCards.map(c => (
                <EmbeddedFlashcardBlock
                  key={c.id}
                  cardId={c.id}
                  onRemove={() => dissociateCardFromNote(note.id, c.id)}
                  onNavigateToDeck={(deckId) => onNavigate({ type: 'deck', deckId })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gaveta de Adicionar Questão */}
      {activeDrawer === 'addQuestion' && (
        <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 shadow-lg space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Buscar e Vincular Questão:</h4>
            <button onClick={() => setActiveDrawer('none')} className="text-xs text-gray-400">✕</button>
          </div>
          <input
            type="text"
            placeholder="Buscar por QID ou texto do enunciado..."
            value={searchQuestion}
            onChange={(e) => setSearchQuestion(e.target.value)}
            className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {questions
              .filter(q => !note.associatedQuestionIds?.includes(q.id) && !note.associatedQuestionIds?.includes(q.qid))
              .filter(q => {
                if (!searchQuestion) return true;
                const term = searchQuestion.toLowerCase();
                return (q.qid && q.qid.includes(term)) || (q.text && q.text.toLowerCase().includes(term));
              })
              .slice(0, 10)
              .map(q => (
                <div
                  key={q.id}
                  onClick={() => {
                    associateQuestionToNote(note.id, q.qid || q.id);
                    setActiveDrawer('questions');
                  }}
                  className="p-3 bg-gray-50 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-950/40 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-blue-600">QID {q.qid || q.id}</span>
                    <p className="text-gray-600 dark:text-gray-300 truncate mt-0.5">
                      {(q.text || q.stem || '').replace(/<[^>]+>/g, '')}
                    </p>
                  </div>
                  <button className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold shrink-0">
                    + Vincular
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Gaveta de Adicionar Flashcard */}
      {activeDrawer === 'addCard' && (
        <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-5 shadow-lg space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Buscar e Vincular Flashcard:</h4>
            <button onClick={() => setActiveDrawer('none')} className="text-xs text-gray-400">✕</button>
          </div>
          <input
            type="text"
            placeholder="Buscar por pergunta ou tags do flashcard..."
            value={searchCard}
            onChange={(e) => setSearchCard(e.target.value)}
            className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {cards
              .filter(c => !note.associatedCardIds?.includes(c.id) && !note.embeddedFlashcardIds?.includes(c.id))
              .filter(c => {
                if (!searchCard) return true;
                const term = searchCard.toLowerCase();
                return c.front.toLowerCase().includes(term) || (c.tags && c.tags.some(t => t.toLowerCase().includes(term)));
              })
              .slice(0, 10)
              .map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    associateCardToNote(note.id, c.id);
                    setActiveDrawer('cards');
                  }}
                  className="p-3 bg-gray-50 hover:bg-indigo-50 dark:bg-gray-800 dark:hover:bg-indigo-950/40 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white font-semibold truncate">
                      {c.front.replace(/<[^>]+>/g, '')}
                    </p>
                  </div>
                  <button className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold shrink-0">
                    + Vincular
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Mídia: Vídeo Player Embed */}
      {showVideoForm && (
        <VideoEmbedPlayer
          onSave={(url, cap) => {
            const nextMedia = [...mediaItems.filter(m => m.type !== 'video'), {
              id: 'media-' + Date.now(),
              type: 'video' as const,
              url,
              caption: cap,
              createdAt: Date.now()
            }];
            setMediaItems(nextMedia);
            updateStudyNote(note.id, { mediaItems: nextMedia });
          }}
          onDelete={() => {
            const nextMedia = mediaItems.filter(m => m.type !== 'video');
            setMediaItems(nextMedia);
            setShowVideoForm(false);
            updateStudyNote(note.id, { mediaItems: nextMedia });
          }}
        />
      )}

      {/* Mídia: Gravador de Áudio */}
      {showAudioRecorder && (
        <AudioVoiceRecorder
          onSaveAudio={(audioUrl, dur) => {
            const nextMedia = [...mediaItems.filter(m => m.type !== 'audio'), {
              id: 'media-' + Date.now(),
              type: 'audio' as const,
              audioBlobUrl: audioUrl,
              title: `Áudio gravado (${dur || 0}s)`,
              createdAt: Date.now()
            }];
            setMediaItems(nextMedia);
            updateStudyNote(note.id, { mediaItems: nextMedia });
          }}
          onDeleteAudio={() => {
            const nextMedia = mediaItems.filter(m => m.type !== 'audio');
            setMediaItems(nextMedia);
            setShowAudioRecorder(false);
            updateStudyNote(note.id, { mediaItems: nextMedia });
          }}
        />
      )}

      {/* Mídia: Code Sandbox */}
      {showCodeSandbox && (
        <CodeSandboxRunner
          onSave={(codeHtml, codeCss, codeJs) => {
            const nextMedia = [...mediaItems.filter(m => m.type !== 'code_sandbox'), {
              id: 'media-' + Date.now(),
              type: 'code_sandbox' as const,
              codeHtml,
              codeCss,
              codeJs,
              title: 'Sandbox Interativo',
              createdAt: Date.now()
            }];
            setMediaItems(nextMedia);
            updateStudyNote(note.id, { mediaItems: nextMedia });
          }}
          onDelete={() => {
            const nextMedia = mediaItems.filter(m => m.type !== 'code_sandbox');
            setMediaItems(nextMedia);
            setShowCodeSandbox(false);
            updateStudyNote(note.id, { mediaItems: nextMedia });
          }}
        />
      )}

      {/* Document Title & Tags */}
      <div className="space-y-3 bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <input
          type="text"
          placeholder="Título da Nota..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSaveNote}
          className="w-full text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white bg-transparent border-0 focus:outline-none placeholder-gray-300 dark:placeholder-gray-700"
        />

        {/* Tags bar */}
        <div className="flex items-center gap-2 flex-wrap pt-2">
          <Tag className="w-3.5 h-3.5 text-gray-400" />
          {tags.map(t => (
            <span
              key={t}
              className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>#{t}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(t)}
                className="hover:text-rose-500 font-bold text-[10px]"
              >
                ✕
              </button>
            </span>
          ))}

          <input
            type="text"
            placeholder="+ Adicionar tag (Enter)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            className="px-2 py-0.5 text-xs bg-transparent border-0 text-gray-700 dark:text-gray-300 focus:outline-none placeholder-gray-400"
          />
        </div>
      </div>

      {/* Notion-Style Rich Text Editor ou Modo Treino de Clozes */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs min-h-[400px]">
        {previewClozeMode ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <div>
                  <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider">
                    Modo Treino Ativo de Clozes
                  </h4>
                  <p className="text-[11px] text-purple-700 dark:text-purple-300">
                    Clique em qualquer lacuna <span className="font-bold underline">[...]</span> para revelar ou ocultar a resposta e testar sua memória.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewClozeMode(false)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Voltar à Edição
              </button>
            </div>

            <div
              className="prose dark:prose-invert max-w-none text-sm text-gray-900 dark:text-gray-100 leading-relaxed p-2"
              dangerouslySetInnerHTML={{ __html: renderCardText(content, false) || '<p class="italic text-gray-400">Nota sem conteúdo.</p>' }}
            />
          </div>
        ) : (
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="Comece a escrever sua nota ou pressione as opções acima para inserir vídeos, áudios, flashcards, blocos de HTML..."
            minHeight="350px"
          />
        )}
      </div>

      {/* Blocos de HTML Seguro / Sandbox Salvos na Nota */}
      {mediaItems.filter(m => m.type === 'code_sandbox').length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-indigo-500" />
              <span>Blocos de HTML Seguro Integrados ({mediaItems.filter(m => m.type === 'code_sandbox').length})</span>
            </h4>
            <span className="text-[11px] text-gray-400">Isolados com sandbox iframe</span>
          </div>

          <div className="space-y-3">
            {mediaItems.filter(m => m.type === 'code_sandbox').map((item) => (
              <SafeIsolatedHtmlBlock
                key={item.id}
                html={item.codeHtml || ''}
                css={item.codeCss}
                js={item.codeJs}
                title={item.title || 'Bloco de HTML Seguro'}
                onEdit={() => {
                  setEditingHtmlItem({
                    id: item.id,
                    title: item.title,
                    html: item.codeHtml,
                    css: item.codeCss,
                    js: item.codeJs
                  });
                  setShowSafeHtmlModal(true);
                }}
                onDelete={() => {
                  const nextMedia = mediaItems.filter(m => m.id !== item.id);
                  setMediaItems(nextMedia);
                  updateStudyNote(note.id, { mediaItems: nextMedia });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal para Inserção de HTML Seguro (Iframe Sandbox) */}
      <SafeHtmlInsertModal
        isOpen={showSafeHtmlModal}
        initialTitle={editingHtmlItem?.title}
        initialHtml={editingHtmlItem?.html}
        initialCss={editingHtmlItem?.css}
        initialJs={editingHtmlItem?.js}
        onClose={() => {
          setShowSafeHtmlModal(false);
          setEditingHtmlItem(null);
        }}
        onSave={(data) => {
          if (editingHtmlItem && editingHtmlItem.id) {
            const nextMedia = mediaItems.map(m => m.id === editingHtmlItem.id ? {
              ...m,
              title: data.title,
              codeHtml: data.html,
              codeCss: data.css,
              codeJs: data.js
            } : m);
            setMediaItems(nextMedia);
            updateStudyNote(note.id, { mediaItems: nextMedia });
          } else {
            const newMedia = {
              id: 'media-' + Date.now(),
              type: 'code_sandbox' as const,
              title: data.title,
              codeHtml: data.html,
              codeCss: data.css,
              codeJs: data.js,
              createdAt: Date.now()
            };
            const nextMedia = [...mediaItems, newMedia];
            setMediaItems(nextMedia);
            updateStudyNote(note.id, { mediaItems: nextMedia });
          }
          setEditingHtmlItem(null);
          setShowSafeHtmlModal(false);
        }}
      />

      {/* Flashcards Embutidos Exibidos na Nota com Botão Revelar/Ocultar Verso */}
      {note.embeddedFlashcardIds && note.embeddedFlashcardIds.length > 0 && (
        <div className="space-y-3 pt-4">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>⚡</span>
            <span>Flashcards Embutidos nesta Nota:</span>
          </h4>
          <div className="space-y-3">
            {note.embeddedFlashcardIds.map(cId => (
              <EmbeddedFlashcardBlock
                key={cId}
                cardId={cId}
                onRemove={() => dissociateCardFromNote(note.id, cId)}
                onNavigateToDeck={(deckId) => onNavigate({ type: 'deck', deckId })}
              />
            ))}
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        defaultAreaId={areaId}
        defaultNoteId={note.id}
        onClose={() => setIsPdfModalOpen(false)}
      />
    </div>
  );
};
