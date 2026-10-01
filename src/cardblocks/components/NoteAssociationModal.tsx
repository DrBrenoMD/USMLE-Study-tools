import React, { useState } from 'react';
import { useStore, StudyNote } from '../store/useStore';
import { BookOpen, Search, Plus, X, Check, Link as LinkIcon, Trash2, ExternalLink, Sparkles } from 'lucide-react';

interface NoteAssociationModalProps {
  onClose: () => void;
  targetType: 'card' | 'question';
  targetId: string; // cardId or questionId / qid
  targetTitle?: string;
  defaultStemOrFront?: string;
  defaultExplanationOrBack?: string;
  onNavigateToNote?: (noteId: string) => void;
}

export const NoteAssociationModal: React.FC<NoteAssociationModalProps> = ({
  onClose,
  targetType,
  targetId,
  targetTitle = '',
  defaultStemOrFront = '',
  defaultExplanationOrBack = '',
  onNavigateToNote
}) => {
  const {
    studyNotes,
    notebookAreas,
    notebookSystems,
    notebookTopics,
    associateCardToNote,
    dissociateCardFromNote,
    associateQuestionToNote,
    dissociateQuestionFromNote,
    createStudyNote,
    createNotebookArea
  } = useStore();

  const [search, setSearch] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState(targetTitle || (targetType === 'card' ? 'Nota sobre Flashcard' : `Nota sobre Questão ${targetId}`));
  const [selectedAreaId, setSelectedAreaId] = useState<string>(notebookAreas[0]?.id || '');
  const [selectedSystemId, setSelectedSystemId] = useState<string>('');

  // Encontra notas já associadas a este item
  const associatedNotes = studyNotes.filter(n => {
    if (targetType === 'card') {
      return n.associatedCardIds?.includes(targetId) || n.embeddedFlashcardIds?.includes(targetId);
    } else {
      return n.associatedQuestionIds?.includes(targetId);
    }
  });

  const associatedNoteIds = new Set(associatedNotes.map(n => n.id));

  // Filtra notas disponíveis para vincular
  const availableNotes = studyNotes.filter(n => {
    if (associatedNoteIds.has(n.id)) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    const area = notebookAreas.find(a => a.id === n.areaId);
    return (
      n.title.toLowerCase().includes(term) ||
      (n.tags && n.tags.some(t => t.toLowerCase().includes(term))) ||
      (area && area.name.toLowerCase().includes(term))
    );
  });

  const handleToggleAssociation = (noteId: string, isCurrentlyLinked: boolean) => {
    if (targetType === 'card') {
      if (isCurrentlyLinked) {
        dissociateCardFromNote(noteId, targetId);
      } else {
        associateCardToNote(noteId, targetId);
      }
    } else {
      if (isCurrentlyLinked) {
        dissociateQuestionFromNote(noteId, targetId);
      } else {
        associateQuestionToNote(noteId, targetId);
      }
    }
  };

  const handleCreateAndLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let areaId = selectedAreaId;
    if (!areaId) {
      if (notebookAreas.length > 0) {
        areaId = notebookAreas[0].id;
      } else {
        areaId = createNotebookArea('Clínica Médica', '#3b82f6');
      }
    }

    let initialContent = '';
    if (defaultStemOrFront) {
      initialContent = `<h3>${defaultStemOrFront}</h3>\n`;
    }
    if (defaultExplanationOrBack) {
      initialContent += `<div class="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl my-2 border border-blue-200 dark:border-blue-900/60">${defaultExplanationOrBack}</div>`;
    }

    const noteId = createStudyNote({
      title: newTitle.trim(),
      areaId,
      systemId: selectedSystemId || null,
      content: initialContent || '<p>Anotações do estudo...</p>',
      icon: targetType === 'card' ? '⚡' : '🎯',
      associatedCardIds: targetType === 'card' ? [targetId] : [],
      associatedQuestionIds: targetType === 'question' ? [targetId] : [],
      embeddedFlashcardIds: targetType === 'card' ? [targetId] : []
    });

    setIsCreatingNew(false);
    if (onNavigateToNote) {
      onNavigateToNote(noteId);
      onClose();
    }
  };

  const availableSystems = notebookSystems.filter(s => s.areaId === selectedAreaId);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl max-w-xl w-full space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Associar aos Cadernos de Estudo
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Vincule este {targetType === 'card' ? 'flashcard' : 'item de questão'} a notas nos seus cadernos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário de Criar Nova Nota */}
        {isCreatingNew ? (
          <form onSubmit={handleCreateAndLink} className="space-y-3.5 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                Criar Nova Nota Vinculada
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancelar
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Título da Nota *
              </label>
              <input
                type="text"
                placeholder="Título da anotação..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Área (Obrigatória) *
                </label>
                <select
                  value={selectedAreaId}
                  onChange={(e) => {
                    setSelectedAreaId(e.target.value);
                    setSelectedSystemId('');
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {notebookAreas.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Sistema (Opcional)
                </label>
                <select
                  value={selectedSystemId}
                  onChange={(e) => setSelectedSystemId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Nenhum / Geral</option>
                  {availableSystems.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar e Abrir Nota</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsCreatingNew(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar Nova Nota para este Item</span>
            </button>
          </div>
        )}

        {/* Notas já associadas */}
        {associatedNotes.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Notas Vinculadas ({associatedNotes.length}):</span>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {associatedNotes.map(n => {
                const area = notebookAreas.find(a => a.id === n.areaId);
                return (
                  <div
                    key={n.id}
                    className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-base">{n.icon || '📝'}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {n.title}
                        </div>
                        {area && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />
                            <span>{area.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onNavigateToNote && (
                        <button
                          onClick={() => {
                            onNavigateToNote(n.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold shadow-2xs hover:bg-gray-50 flex items-center gap-1"
                          title="Abrir nota"
                        >
                          <span>Abrir</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleAssociation(n.id, true)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Desvincular nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Buscar e Vincular a Notas Existentes */}
        <div className="flex-1 min-h-0 flex flex-col space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Vincular a Outras Notas Existentes:
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar nota por título, área ou tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[140px] max-h-52 pr-1">
            {availableNotes.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">
                {search ? 'Nenhuma outra nota encontrada.' : 'Todas as notas já estão vinculadas ou crie uma nova acima.'}
              </div>
            ) : (
              availableNotes.map(n => {
                const area = notebookAreas.find(a => a.id === n.areaId);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleToggleAssociation(n.id, false)}
                    className="p-2.5 bg-gray-50 hover:bg-blue-50/60 dark:bg-gray-800/60 dark:hover:bg-blue-950/30 border border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-800 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-sm">{n.icon || '📝'}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {n.title}
                        </div>
                        {area && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: area.color }} />
                            <span>{area.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-2.5 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Vincular</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
